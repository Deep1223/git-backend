const mongoose = require('mongoose');

const cmsReturnsPageSchema = new mongoose.Schema(
    {
        singletonKey: { type: String, default: 'main', unique: true, trim: true },
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        eligible: { type: [String], default: [] },
        notEligible: { type: [String], default: [] },
        howTo: { type: [String], default: [] },
        supportNote: { type: String, default: '' },
        refundPolicyUrl: { type: String, default: '' },
        recordinfo: {
            createat: { type: Date, default: Date.now },
            createby: { type: String },
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('CmsReturnsPage', cmsReturnsPageSchema);
