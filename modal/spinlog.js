const mongoose = require('mongoose');

const spinLogSchema = new mongoose.Schema(
    {
        email: { type: String, trim: true, lowercase: true, default: null },
        phone: { type: String, trim: true, default: null },
        session_id: { type: String, trim: true, default: null },
        is_spinned: { type: Boolean, default: false },
        reward: { type: String, trim: true, default: '' },
        coupon_code: { type: String, trim: true, default: '' },
        coupon_redeemed: { type: Boolean, default: false },
        created_at: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

spinLogSchema.index({ email: 1 }, { unique: true, sparse: true });
spinLogSchema.index({ phone: 1 }, { unique: true, sparse: true });
spinLogSchema.index({ session_id: 1 }, { unique: true, sparse: true });
spinLogSchema.index({ created_at: -1 });

module.exports = mongoose.model('SpinLog', spinLogSchema, 'spin_logs');
