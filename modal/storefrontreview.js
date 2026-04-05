const mongoose = require('mongoose');

const storefrontReviewSchema = new mongoose.Schema(
    {
        productId: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        productName: {
            type: String,
            trim: true,
            default: '',
        },
        reviewerName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        title: {
            type: String,
            trim: true,
            maxlength: 120,
            default: '',
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        source: {
            type: String,
            trim: true,
            default: 'orinket-web',
        },
        // 1 = visible (approved/published), 0 = hidden
        status: {
            type: Number,
            default: 1,
            index: true,
        },
        recordinfo: {
            createat: { type: Date, default: Date.now },
            createby: { type: String, default: 'customer' },
            updateat: { type: Date },
            updateby: { type: String },
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('StorefrontReview', storefrontReviewSchema);
