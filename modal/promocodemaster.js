const mongoose = require('mongoose');

/**
 * Storefront promo codes (validated via POST /api/promo/validate).
 * Amounts & minOrder are in the same currency as cart subtotal (e.g. INR).
 */
const promoCodeSchema = new mongoose.Schema(
    {
        code: { type: String, required: true, trim: true, uppercase: true },
        type: { type: String, enum: ['percent', 'fixed'], required: true },
        value: { type: Number, required: true },
        minOrder: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        validFrom: { type: Date, default: null },
        validTo: { type: Date, default: null },
        description: { type: String, trim: true, default: '' },
        maxRedemptions: { type: Number, default: null },
        redemptionCount: { type: Number, default: 0 },
    },
    { versionKey: false, timestamps: true }
);

promoCodeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('PromoCode', promoCodeSchema, 'promo_codes');
