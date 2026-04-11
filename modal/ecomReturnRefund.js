const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema(
    {
        status: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },
        at: { type: Date, default: Date.now },
        by: { type: String, trim: true, default: '' },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { _id: false }
);

const refundSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['not_started', 'pending', 'processed', 'failed'],
            default: 'not_started',
            index: true,
        },
        amount: { type: Number, min: 0, default: 0 },
        method: { type: String, trim: true, default: '' },
        reference: { type: String, trim: true, default: '' },
        processedAt: { type: Date, default: null },
        note: { type: String, trim: true, default: '' },
        proofUrls: { type: [String], default: [] },
    },
    { _id: false }
);

const ecomReturnRefundSchema = new mongoose.Schema(
    {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomOrder', required: true, unique: true, index: true },
        status: {
            type: String,
            enum: ['requested', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'refund_pending', 'refunded', 'closed'],
            default: 'requested',
            index: true,
        },
        reason: { type: String, trim: true, default: '' },
        customerNote: { type: String, trim: true, default: '' },
        requestedAt: { type: Date, default: Date.now },
        requestProofUrls: { type: [String], default: [] },
        approvalNote: { type: String, trim: true, default: '' },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: String, trim: true, default: '' },
        rejectedAt: { type: Date, default: null },
        rejectedBy: { type: String, trim: true, default: '' },
        rejectionReason: { type: String, trim: true, default: '' },
        pickupScheduledAt: { type: Date, default: null },
        pickupReference: { type: String, trim: true, default: '' },
        pickupNote: { type: String, trim: true, default: '' },
        receivedAt: { type: Date, default: null },
        receivedBy: { type: String, trim: true, default: '' },
        receivingNote: { type: String, trim: true, default: '' },
        qualityCheckPassed: { type: Boolean, default: false },
        qualityCheckNote: { type: String, trim: true, default: '' },
        refund: { type: refundSchema, default: () => ({}) },
        timeline: { type: [timelineEntrySchema], default: [] },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomReturnRefund', ecomReturnRefundSchema);
