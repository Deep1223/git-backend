const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct', default: null },
        name: { type: String, required: true, trim: true },
        /** Snapshot from Product Master at checkout (for admin list / slips). */
        productSeries: { type: String, trim: true, default: '' },
        image: { type: String, default: '' },
        quantity: { type: Number, min: 1, required: true },
        price: { type: Number, min: 0, required: true },
    },
    { _id: false }
);

/** Canonical lifecycle + legacy `processing` for older documents */
const ORDER_STATUS_ENUM = [
    'pending',
    'processing',
    'confirmed',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'return_requested',
    'returned',
    'refunded',
];

const ecomOrderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },
        sessionId: { type: String, default: null, index: true },
        /** Human-readable id for packing slips / customer service */
        orderNumber: { type: String, trim: true, default: '', index: true, sparse: true },
        items: { type: [orderItemSchema], default: [] },
        /** Subtotal before promo (sum of line items); kept for records when a coupon is used */
        subtotalAmount: { type: Number, min: 0, default: 0 },
        promoCode: { type: String, default: '', trim: true },
        discountAmount: { type: Number, min: 0, default: 0 },
        totalAmount: { type: Number, min: 0, required: true },
        paymentMethod: {
            type: String,
            enum: ['cod', 'online'],
            default: 'cod',
            index: true,
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending',
            index: true,
        },
        orderStatus: {
            type: String,
            enum: ORDER_STATUS_ENUM,
            default: 'pending',
            index: true,
        },
        paymentProvider: { type: String, default: 'dummy' },
        paymentReference: { type: String, default: '' },
        /** Optional link to saved user address record (snapshot still in shippingAddress) */
        addressId: { type: mongoose.Schema.Types.ObjectId, default: null },
        shippingAddress: {
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            line1: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            pincode: { type: String, default: '' },
        },
        cancelReason: { type: String, default: '', trim: true },
        trackingUrl: { type: String, default: '', trim: true },
        inventoryRestoredAt: { type: Date, default: null },
        autoCancelledAt: { type: Date, default: null },
    },
    { timestamps: true }
);

const EcomOrder = mongoose.model('EcomOrder', ecomOrderSchema);
EcomOrder.ORDER_STATUS_ENUM = ORDER_STATUS_ENUM;
module.exports = EcomOrder;
