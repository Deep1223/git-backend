const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv-vault');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const router = require('./router');
const errorHandler = require('./middleware/error');
const { startEcomJobs } = require('./jobs/ecom');
const webSocketServer = require('./lib/websocketServer');

// Load env vars
dotenv.config();

const app = express();

// When behind nginx/Railway/etc., set TRUST_PROXY=1 so req.ip and rate limits use X-Forwarded-For.
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
}

// Enable CORS at the very top (comma-separated FRONTEND_URL; default covers common CRA ports)
const defaultDevOrigins = 'http://localhost:3000,http://localhost:3001,http://localhost:4000';
const allowedOrigins = (process.env.FRONTEND_URL || defaultDevOrigins)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Set security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development to avoid connection issues
    hsts: false,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Logging in dev
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Standard combined format for production
    app.use(morgan('combined'));
}

// Body parser — 10kb was too small for general settings (banners, SEO, JSON blocks).
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// Cookie parser
app.use(cookieParser());

// Sanitize data (Prevents NoSQL injection)
app.use((req, res, next) => {
    if (req.body) req.body = mongoSanitize(req.body);
    if (req.query) req.query = mongoSanitize(req.query);
    if (req.params) req.params = mongoSanitize(req.params);
    next();
});

// Prevent http param pollution
app.use(hpp());

// General Rate limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: 1000, // Increased for development testing
    message: 'Too many requests from this IP, please try again after 10 minutes'
});

// Stricter Rate limiting for Auth routes (Login/Signup)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 mins
    max: 100, // Increased for development testing
    message: 'Too many login attempts, please try again after 15 minutes'
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// Mount router
app.use('/api', router);

// Error handler (must be after router)
app.use(errorHandler);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/common-project');
    } catch (err) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    }
};

connectDB();
startEcomJobs();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server started successfully on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize WebSocket server
    const wsInitialized = webSocketServer.initialize(server);
    if (wsInitialized) {
        console.log('WebSocket server initialized successfully');
    } else {
        console.log('WebSocket server initialization failed');
    }
});
