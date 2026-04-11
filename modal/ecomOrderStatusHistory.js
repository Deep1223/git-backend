const mongoose = require('mongoose');

const ecomOrderStatusHistorySchema = new mongoose.Schema(
    {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomOrder', required: true, index: true },
        status: { type: String, required: true, trim: true },
        /** Dashboard user id (string) when available */
        changedBy: { type: String, default: '' },
        note: { type: String, default: '' },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

ecomOrderStatusHistorySchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model('EcomOrderStatusHistory', ecomOrderStatusHistorySchema);
