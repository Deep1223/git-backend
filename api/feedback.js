const Feedback = require('../modal/feedback');

exports.submitFeedback = async (req, res) => {
    try {
        const { rating, type, message, includeScreenshot } = req.body;
        const r = Number(rating);
        if (!Number.isFinite(r) || r < 1 || r > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }
        if (!type || typeof type !== 'string' || !type.trim()) {
            return res.status(400).json({ success: false, message: 'Feedback type is required' });
        }
        await Feedback.create({
            user: req.user.id,
            rating: Math.round(r),
            type: type.trim().slice(0, 80),
            message: String(message || '').trim().slice(0, 5000),
            includeScreenshot: Boolean(includeScreenshot),
        });
        res.status(201).json({ success: true, message: 'Thanks for your feedback' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};
