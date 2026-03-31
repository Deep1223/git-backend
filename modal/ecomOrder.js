const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct', default: null },
        name: { type: String, required: true, trim: true },
        image: { type: String, default: '' },
        quantity: { type: Number, min: 1, required: true },
        price: { type: Number, min: 0, required: true },
    },
    { _id: false }
);

const ecomOrderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },
        sessionId: { type: String, default: null, index: true },
        items: { type: [orderItemSchema], default: [] },
        totalAmount: { type: Number, min: 0, required: true },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending',
            index: true,
        },
        orderStatus: {
            type: String,
            enum: ['processing', 'confirmed', 'shipped', 'delivered', 'cancelled'],
            default: 'processing',
            index: true,
        },
        paymentProvider: { type: String, default: 'dummy' },
        paymentReference: { type: String, default: '' },
        shippingAddress: {
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            line1: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            pincode: { type: String, default: '' },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomOrder', ecomOrderSchema);
