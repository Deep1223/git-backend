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

// Load env vars
dotenv.config();

const app = express();

// Enable CORS at the very top
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// Body parser with limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server started successfully on port ${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});
