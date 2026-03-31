const mongoose = require('mongoose');

const ecomAnalyticsSchema = new mongoose.Schema(
    {
        date: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
        views: { type: Number, default: 0 },
        sales: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        orders: { type: Number, default: 0 },
        topProducts: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct' },
                units: { type: Number, default: 0 },
            },
        ],
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomAnalytics', ecomAnalyticsSchema);
