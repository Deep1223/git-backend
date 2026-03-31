const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, default: '' },
        value: { type: String, trim: true, default: '' },
        stock: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const ecomProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true, unique: true, index: true },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EcomCategory',
            required: true,
            index: true,
        },
        price: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, default: 0, min: 0 },
        images: { type: [String], default: [] },
        stock: { type: Number, default: 0, min: 0, index: true },
        tags: { type: [String], default: [], index: true },
        variants: { type: [variantSchema], default: [] },
        views: { type: Number, default: 0 },
        recentSalesCount: { type: Number, default: 0 },
        isLowStock: { type: Boolean, default: false, index: true },
        hidden: { type: Boolean, default: false, index: true },
        metadata: {
            isTopStyle: { type: Boolean, default: false },
            isTrending: { type: Boolean, default: false },
            score: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomProduct', ecomProductSchema);
