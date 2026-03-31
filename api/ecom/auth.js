const EcomUser = require('../../modal/ecomUser');

function authCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
    };
}

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'name, email and password are required' });
        }
        const exists = await EcomUser.findOne({ email: String(email).toLowerCase().trim() });
        if (exists) {
            return res.status(409).json({ success: false, message: 'Email already exists' });
        }
        const user = await EcomUser.create({ name, email, password, role: 'customer' });
        const token = user.getSignedJwtToken();
        res.cookie('ecomToken', token, authCookieOptions());
        return res.status(201).json({
            success: true,
            data: { id: user._id, name: user.name, email: user.email, role: user.role, token },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'register_failed' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required' });
        }
        const user = await EcomUser.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const ok = await user.matchPassword(password);
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = user.getSignedJwtToken();
        res.cookie('ecomToken', token, authCookieOptions());
        return res.status(200).json({
            success: true,
            data: { id: user._id, name: user.name, email: user.email, role: user.role, token },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'login_failed' });
    }
};

exports.me = async (req, res) => {
    if (!req.ecomUser) return res.status(200).json({ success: true, data: null });
    return res.status(200).json({
        success: true,
        data: {
            id: req.ecomUser._id,
            name: req.ecomUser.name,
            email: req.ecomUser.email,
            role: req.ecomUser.role,
        },
    });
};

exports.logout = async (_req, res) => {
    res.cookie('ecomToken', 'none', { ...authCookieOptions(), maxAge: 1 });
    return res.status(200).json({ success: true, message: 'Logged out' });
};
