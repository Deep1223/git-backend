const mongoose = require('mongoose');

const cmsFaqEntrySchema = new mongoose.Schema(
    {
        groupTitle: { type: String, default: '', trim: true },
        question: { type: String, required: true, trim: true },
        answer: { type: String, default: '' },
        sortOrder: { type: Number, default: 0 },
        status: { type: Number, default: 1 },
        recordinfo: {
            createat: { type: Date, default: Date.now },
            createby: { type: String },
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CmsFaqEntry', cmsFaqEntrySchema);
