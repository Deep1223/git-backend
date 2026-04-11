const mongoose = require('mongoose');

const shipmentEventSchema = new mongoose.Schema(
    {
        type: { type: String, trim: true, default: '' },
        label: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, default: '' },
        at: { type: Date, default: Date.now },
        by: { type: String, trim: true, default: '' },
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { _id: false }
);

const ecomShipmentSchema = new mongoose.Schema(
    {
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomOrder', required: true, unique: true, index: true },
        courierCode: { type: String, trim: true, default: '' },
        courierName: { type: String, trim: true, default: '' },
        serviceLevel: { type: String, trim: true, default: '' },
        awbNumber: { type: String, trim: true, default: '', index: true },
        awbDocumentUrl: { type: String, trim: true, default: '' },
        shippingLabelUrl: { type: String, trim: true, default: '' },
        trackingUrl: { type: String, trim: true, default: '' },
        assignmentStatus: {
            type: String,
            enum: ['unassigned', 'assigned', 'reassigned'],
            default: 'unassigned',
            index: true,
        },
        assignedTo: { type: String, trim: true, default: '' },
        assignmentNotes: { type: String, trim: true, default: '' },
        pickupStatus: {
            type: String,
            enum: ['not_required', 'pending', 'scheduled', 'booked', 'picked_up', 'missed', 'cancelled'],
            default: 'pending',
            index: true,
        },
        pickupScheduledAt: { type: Date, default: null },
        pickupBookedAt: { type: Date, default: null },
        pickupWindowStart: { type: Date, default: null },
        pickupWindowEnd: { type: Date, default: null },
        pickupReference: { type: String, trim: true, default: '' },
        shippedAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
        exceptionStatus: {
            type: String,
            enum: ['none', 'open', 'monitoring', 'resolved'],
            default: 'none',
            index: true,
        },
        exceptionCode: { type: String, trim: true, default: '' },
        exceptionMessage: { type: String, trim: true, default: '' },
        exceptionOpenedAt: { type: Date, default: null },
        exceptionResolvedAt: { type: Date, default: null },
        exceptionMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
        events: { type: [shipmentEventSchema], default: [] },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomShipment', ecomShipmentSchema);
