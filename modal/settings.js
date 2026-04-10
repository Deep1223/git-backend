const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        spin_popup_frequency_days: { type: Number, default: 1, min: 1 },
        ecom_job_interval_ms: { type: Number, default: 60 * 60 * 1000, min: 60 * 1000 },
    },
    { versionKey: false }
);

module.exports = mongoose.model('Settings', settingsSchema, 'settings');
