const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
    {
        name: { type: String, default: '' },
        eta: { type: String, default: '' },
        note: { type: String, default: '' },
    },
    { _id: false }
);

const cmsShippingPageSchema = new mongoose.Schema(
    {
        singletonKey: { type: String, default: 'main', unique: true, trim: true },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        packaging: { type: String, default: '' },
        zones: { type: [zoneSchema], default: [] },
        bullets: { type: [String], default: [] },
        recordinfo: {
            createat: { type: Date, default: Date.now },
            createby: { type: String },
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CmsShippingPage', cmsShippingPageSchema);
