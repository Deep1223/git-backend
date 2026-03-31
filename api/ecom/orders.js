const EcomOrder = require('../../modal/ecomOrder');
const EcomCart = require('../../modal/ecomCart');
const EcomProduct = require('../../modal/ecomProduct');
const EcomAnalytics = require('../../modal/ecomAnalytics');
const { resolveActor } = require('./helpers');

function dayKey(date) {
    return date.toISOString().slice(0, 10);
}

function filterByActor(actor) {
    return actor.userId ? { user: actor.userId } : { sessionId: actor.sessionId };
}

exports.createOrder = async (req, res) => {
    try {
        const actor = resolveActor(req);
        if (!actor.userId && !actor.sessionId) {
            return res.status(400).json({ success: false, message: 'sessionId required for guest checkout' });
        }
        const items = [];
        let totalAmount = 0;
        const cart = await EcomCart.findOne(filterByActor(actor));
        if (cart?.items?.length) {
            const productIds = cart.items.map((i) => i.product);
            const products = await EcomProduct.find({ _id: { $in: productIds } }).lean();
            const productMap = new Map(products.map((p) => [String(p._id), p]));

            for (const row of cart.items) {
                const product = productMap.get(String(row.product));
                if (!product || product.hidden || product.stock < row.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock unavailable for one or more products`,
                    });
                }
                const line = {
                    product: product._id,
                    name: product.name,
                    image: product.images?.[0] || '',
                    quantity: row.quantity,
                    price: row.priceSnapshot,
                };
                items.push(line);
                totalAmount += line.quantity * line.price;
            }
        } else if (Array.isArray(req.body?.items) && req.body.items.length > 0) {
            for (const row of req.body.items) {
                const line = {
                    product: row.productId || null,
                    name: String(row.name || 'Product'),
                    image: String(row.image || ''),
                    quantity: Math.max(1, Number(row.quantity || 1)),
                    price: Math.max(0, Number(row.price || 0)),
                };
                items.push(line);
                totalAmount += line.quantity * line.price;
            }
        } else {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const order = await EcomOrder.create({
            ...filterByActor(actor),
            items,
            totalAmount,
            paymentStatus: 'pending',
            orderStatus: 'processing',
            paymentProvider: req.body?.paymentMethod || 'dummy',
            paymentReference: `DUMMY_${Date.now()}`,
            shippingAddress: req.body?.shippingAddress || {},
        });

        for (const item of items) {
            if (!item.product) continue;
            await EcomProduct.findByIdAndUpdate(item.product, {
                $inc: {
                    stock: -item.quantity,
                    recentSalesCount: item.quantity,
                },
            });
        }

        await EcomAnalytics.findOneAndUpdate(
            { date: dayKey(new Date()) },
            { $inc: { revenue: totalAmount, sales: items.reduce((s, i) => s + i.quantity, 0), orders: 1 } },
            { upsert: true, new: true }
        );

        if (cart) {
            cart.items = [];
            await cart.save();
        }

        return res.status(201).json({ success: true, data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'order_create_failed' });
    }
};

exports.listOrders = async (req, res) => {
    try {
        const actor = resolveActor(req);
        if (!actor.userId && !actor.sessionId) {
            return res.status(200).json({ success: true, data: [] });
        }
        const orders = await EcomOrder.find(filterByActor(actor)).sort({ createdAt: -1 }).lean();
        return res.status(200).json({ success: true, data: orders });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'orders_failed' });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const actor = resolveActor(req);
        const order = await EcomOrder.findOne({ _id: req.params.id, ...filterByActor(actor) }).lean();
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'order_failed' });
    }
};

exports.dummyCreatePaymentOrder = async (req, res) => {
    const amount = Number(req.body?.amount || 0);
    const now = Date.now();
    return res.status(200).json({
        success: true,
        data: {
            gateway: 'dummy',
            orderId: `dummy_order_${now}`,
            amount,
            currency: req.body?.currency || 'INR',
            razorpayReadyPayload: {
                key: process.env.RAZORPAY_KEY_ID || '',
                amount: Math.round(amount * 100),
                currency: req.body?.currency || 'INR',
                name: 'Orinket',
                description: 'Order payment',
            },
        },
    });
};

exports.verifyPayment = async (req, res) => {
    try {
        const { orderId, status, paymentReference } = req.body || {};
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' });
        }
        const normalizedStatus = String(status || '').toLowerCase();
        const paymentStatus = normalizedStatus === 'success' ? 'paid' : normalizedStatus === 'failed' ? 'failed' : 'pending';
        const orderStatus = paymentStatus === 'paid' ? 'confirmed' : paymentStatus === 'failed' ? 'cancelled' : 'processing';
        const order = await EcomOrder.findByIdAndUpdate(
            orderId,
            {
                paymentStatus,
                orderStatus,
                paymentReference: paymentReference || `PAY_${Date.now()}`,
            },
            { new: true }
        );
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'payment_verify_failed' });
    }
};

exports.razorpayWebhook = async (req, res) => {
    try {
        const event = String(req.body?.event || '');
        const payload = req.body?.payload || {};
        const orderId =
            payload?.payment?.entity?.notes?.orderId ||
            payload?.order?.entity?.notes?.orderId ||
            payload?.payment?.entity?.order_id ||
            null;

        if (!orderId) {
            return res.status(200).json({ success: true, ignored: true, message: 'No order reference found' });
        }

        const paidEvents = new Set(['payment.captured', 'order.paid']);
        const failedEvents = new Set(['payment.failed']);
        const paymentStatus = paidEvents.has(event) ? 'paid' : failedEvents.has(event) ? 'failed' : 'pending';
        const orderStatus = paymentStatus === 'paid' ? 'confirmed' : paymentStatus === 'failed' ? 'cancelled' : 'processing';

        await EcomOrder.findByIdAndUpdate(orderId, {
            paymentStatus,
            orderStatus,
            paymentReference: payload?.payment?.entity?.id || payload?.order?.entity?.id || '',
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'razorpay_webhook_failed' });
    }
};
