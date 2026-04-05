const Settings = require('../modal/settings');

function sanitizeFrequency(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
}

async function getOrCreateSettings() {
    let doc = await Settings.findOne().sort({ _id: 1 });
    if (!doc) {
        doc = await Settings.create({ spin_popup_frequency_days: 1 });
    }
    return doc;
}

exports.getSettings = async (req, res) => {
    try {
        const doc = await getOrCreateSettings();
        return res.status(200).json({
            success: true,
            data: { spin_popup_frequency_days: sanitizeFrequency(doc.spin_popup_frequency_days) },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const spin_popup_frequency_days = sanitizeFrequency(req.body?.spin_popup_frequency_days);
        const existing = await Settings.findOne().sort({ _id: 1 });
        let doc;
        if (!existing) {
            doc = await Settings.create({ spin_popup_frequency_days });
        } else {
            existing.spin_popup_frequency_days = spin_popup_frequency_days;
            doc = await existing.save();
        }
        return res.status(200).json({
            success: true,
            data: { spin_popup_frequency_days: sanitizeFrequency(doc.spin_popup_frequency_days) },
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
