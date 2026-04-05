const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        spin_popup_frequency_days: { type: Number, default: 1, min: 1 },
    },
    { versionKey: false }
);

module.exports = mongoose.model('Settings', settingsSchema, 'settings');
