const mongoose = require('mongoose');

const ecomStorefrontSectionSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            enum: ['top-styles', 'trending', 'recommended', 'new-arrivals'],
            required: true,
            unique: true,
            index: true,
        },
        mode: { type: String, enum: ['auto', 'custom'], default: 'auto' },
        products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct' }],
        hiddenProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct' }],
        ruleConfig: {
            limit: { type: Number, default: 8 },
            basedOnDays: { type: Number, default: 7 },
            minStock: { type: Number, default: 1 },
            sortBy: { type: String, default: 'recentSalesCount' },
        },
        note: { type: String, default: '' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomStorefrontSection', ecomStorefrontSectionSchema);
