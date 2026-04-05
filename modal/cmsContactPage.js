const mongoose = require('mongoose');

const cmsContactPageSchema = new mongoose.Schema(
    {
        singletonKey: { type: String, default: 'main', unique: true, trim: true },
        pageTitle: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
        hours: { type: String, default: '' },
        hoursNote: { type: String, default: '' },
        brandDisplayName: { type: String, default: '' },
        recordinfo: {
            createat: { type: Date, default: Date.now },
            createby: { type: String },
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CmsContactPage', cmsContactPageSchema);
