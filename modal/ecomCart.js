const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomProduct', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        priceSnapshot: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const ecomCartSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },
        sessionId: { type: String, default: null, index: true },
        items: { type: [cartItemSchema], default: [] },
    },
    { timestamps: true }
);

module.exports = mongoose.model('EcomCart', ecomCartSchema);
