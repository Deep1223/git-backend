const { BRAND } = require('../../config/brand');
const EcomOrder = require('../../modal/ecomOrder');
const EcomCart = require('../../modal/ecomCart');
const EcomProduct = require('../../modal/ecomProduct');
const EcomAnalytics = require('../../modal/ecomAnalytics');
const SpinLog = require('../../modal/spinlog');
const PromoCode = require('../../modal/promocodemaster');
const { computePromoDiscountForOrder } = require('../promoValidate');
const { resolveActor, mapProductPublic, PRODUCT_MASTER_PUBLIC_SELECT } = require('./helpers');
const { mirrorAvailableQtyFromEcomProduct } = require('../../lib/catalogProductMasterSync');
const { notifyAllAdmins } = require('../../lib/adminNotify');
const { allocateOrderNumber, appendStatusHistory } = require('../../lib/ecomOrderAdminHelpers');
const { sendOrderStatusEmail } = require('../../lib/ecomOrderEmail');
const { markOrderCancelled } = require('../../lib/ecomOrderLifecycle');

function dayKey(date) {
    return date.toISOString().slice(0, 10);
}

function filterByActor(actor) {
    return actor.userId ? { user: actor.userId } : { sessionId: actor.sessionId };
}

function isAutoCancelledOrder(order) {
    return Boolean(order?.autoCancelledAt) && String(order?.orderStatus) === 'cancelled';
}

function normalizePaymentStatus(raw) {
    const normalizedStatus = String(raw || '').toLowerCase();
    if (['success', 'paid', 'captured'].includes(normalizedStatus)) return 'paid';
    if (['failed', 'error', 'expired', 'timeout', 'cancelled'].includes(normalizedStatus)) return 'failed';
    return 'pending';
}

async function handleLatePaidOrder(order, sourceLabel) {
    await appendStatusHistory(order._id, 'cancelled', {
        note: `Late payment callback ignored after auto-cancel (${sourceLabel})`,
    });
    notifyAllAdmins({
        type: 'payment_late_ignored',
        boldName: 'Late payment ignored',
        text: `Late paid callback ignored for order ${order.orderNumber || String(order._id)}`,
        name: 'Late payment ignored',
        body: 'A paid callback arrived after the order had already been auto-cancelled. Review the gateway and reconcile if needed.',
        boldTag: order.orderNumber || String(order._id),
        subDesc: sourceLabel,
        tag: 'Payments',
        sender: 'Gateway',
        initials: 'LP',
        redirectPath: '/order-management/cancelled',
        dedupeKey: `late_paid_${String(order._id)}_${sourceLabel}`,
        dedupeWindowMs: 30 * 60 * 1000,
        meta: { orderId: String(order._id), sourceLabel },
    });
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
            const products = await EcomProduct.find({ _id: { $in: productIds } })
                .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
                .lean();
            const productMap = new Map(products.map((p) => [String(p._id), p]));

            for (const row of cart.items) {
                const product = productMap.get(String(row.product));
                const pub = product ? mapProductPublic(product) : null;
                if (!product || product.hidden || !pub || pub.stock < row.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: 'Stock unavailable for one or more products',
                    });
                }
                const line = {
                    product: product._id,
                    name: pub.name,
                    productSeries: pub.productSeries || '',
                    image: pub.image || '',
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
                    productSeries: String(row.productSeries || '').trim(),
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

        const subtotalBeforeDiscount = totalAmount;
        const itemCount = items.reduce((s, i) => s + i.quantity, 0);
        let promoDiscount = 0;
        let promoCodeSaved = '';
        let spinLogIdToRedeem = null;
        let promoCodeIdToInc = null;

        const rawPromo = String(req.body?.promoCode || '').trim();
        if (rawPromo) {
            const pv = await computePromoDiscountForOrder(rawPromo, subtotalBeforeDiscount, itemCount);
            if (!pv.ok) {
                return res.status(400).json({ success: false, message: pv.message });
            }
            promoDiscount = pv.discount;
            promoCodeSaved = pv.code;
            spinLogIdToRedeem = pv.spinLogId || null;
            promoCodeIdToInc = pv.promoCodeId || null;
        }

        totalAmount = Math.max(0, subtotalBeforeDiscount - promoDiscount);

        const rawPay = String(req.body?.paymentMethod || req.body?.paymentMode || 'cod').toLowerCase();
        const paymentMethod = rawPay === 'online' || rawPay === 'razorpay' || rawPay === 'card' ? 'online' : 'cod';
        const orderNumber = await allocateOrderNumber();

        const order = await EcomOrder.create({
            ...filterByActor(actor),
            orderNumber,
            items,
            subtotalAmount: subtotalBeforeDiscount,
            promoCode: promoCodeSaved,
            discountAmount: promoDiscount,
            totalAmount,
            paymentMethod,
            paymentStatus: 'pending',
            orderStatus: 'pending',
            paymentProvider: req.body?.paymentMethod || 'dummy',
            paymentReference: `DUMMY_${Date.now()}`,
            shippingAddress: req.body?.shippingAddress || {},
        });

        await appendStatusHistory(order._id, 'pending', { note: 'Order placed' });

        if (spinLogIdToRedeem) {
            await SpinLog.findByIdAndUpdate(spinLogIdToRedeem, { $set: { coupon_redeemed: true } });
        }

        if (promoCodeIdToInc) {
            await PromoCode.findByIdAndUpdate(promoCodeIdToInc, { $inc: { redemptionCount: 1 } });
        }

        for (const item of items) {
            if (!item.product) continue;
            await EcomProduct.findByIdAndUpdate(item.product, {
                $inc: {
                    stock: -item.quantity,
                    recentSalesCount: item.quantity,
                },
            });
            await mirrorAvailableQtyFromEcomProduct(item.product);
        }

        await EcomAnalytics.findOneAndUpdate(
            { date: dayKey(new Date()) },
            { $inc: { revenue: totalAmount, sales: itemCount, orders: 1 } },
            { upsert: true, new: true }
        );

        if (cart) {
            cart.items = [];
            await cart.save();
        }

        notifyAllAdmins({
            type: 'new_order',
            boldName: 'New order',
            text: `New order - Rs ${Number(totalAmount).toLocaleString('en-IN')} - ${itemCount} unit(s)`,
            name: 'New order',
            body: `A storefront order was placed. Total Rs ${Number(totalAmount).toLocaleString('en-IN')} across ${items.length} line(s), ${itemCount} unit(s).`,
            boldTag: `Rs ${Number(totalAmount).toLocaleString('en-IN')}`,
            subDesc: `${items.length} line item(s)`,
            tag: 'Orders',
            sender: 'Store',
            initials: 'NO',
            redirectPath: '/order-management',
            meta: { orderId: String(order._id), totalAmount, lineCount: items.length },
        });

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
                name: BRAND.name,
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

        const paymentStatus = normalizePaymentStatus(status);
        const orderStatus = paymentStatus === 'paid' ? 'confirmed' : paymentStatus === 'failed' ? 'cancelled' : 'pending';
        const prev = await EcomOrder.findById(orderId).lean();
        if (!prev) return res.status(404).json({ success: false, message: 'Order not found' });

        if (paymentStatus === 'paid' && isAutoCancelledOrder(prev)) {
            await handleLatePaidOrder(prev, 'verifyPayment');
            return res.status(409).json({
                success: false,
                message: 'Order was auto-cancelled before payment confirmation arrived',
                data: prev,
            });
        }

        if (paymentStatus === 'failed') {
            const cancelled = await markOrderCancelled(orderId, {
                paymentStatus: 'failed',
                cancelReason: prev.cancelReason || 'Payment failed or expired',
                note: 'Payment verification reported failure',
            });
            if (cancelled.error) {
                return res.status(cancelled.error.status).json({ success: false, message: cancelled.error.message });
            }
            notifyAllAdmins({
                type: 'payment_failed',
                boldName: 'Payment failed',
                text: `Payment failed for order ${orderId}`,
                name: 'Payment failed',
                body: 'The payment did not complete. Inventory was released and the order was cancelled.',
                boldTag: 'payment',
                subDesc: 'Gateway reported failure',
                tag: 'Payments',
                sender: 'Payments',
                initials: 'PF',
                redirectPath: '/order-management/cancelled',
                dedupeKey: `payment_failed_${orderId}`,
                dedupeWindowMs: 15 * 60 * 1000,
                meta: { orderId: String(orderId) },
            });
            return res.status(200).json({ success: true, data: cancelled.order });
        }

        const order = await EcomOrder.findByIdAndUpdate(
            orderId,
            {
                paymentStatus,
                orderStatus,
                paymentMethod: 'online',
                paymentReference: paymentReference || `PAY_${Date.now()}`,
            },
            { new: true }
        );

        if (String(prev.orderStatus) !== String(orderStatus)) {
            await appendStatusHistory(orderId, orderStatus, { note: 'Payment verified' });
        }

        if (paymentStatus === 'paid') {
            notifyAllAdmins({
                type: 'payment_success',
                boldName: 'Payment received',
                text: `Payment confirmed for order ${orderId}`,
                name: 'Payment received',
                body: 'Payment was marked successful. Order can move to fulfillment.',
                boldTag: 'paid',
                subDesc: 'Confirmed',
                tag: 'Payments',
                sender: 'Payments',
                initials: 'OK',
                redirectPath: '/order-management',
                dedupeKey: `payment_success_${orderId}`,
                dedupeWindowMs: 15 * 60 * 1000,
                meta: { orderId: String(orderId) },
            });
        }

        return res.status(200).json({ success: true, data: order });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'payment_verify_failed' });
    }
};

exports.requestReturn = async (req, res) => {
    try {
        const actor = resolveActor(req);
        if (!actor.userId && !actor.sessionId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        const order = await EcomOrder.findOne({ _id: req.params.id, ...filterByActor(actor) });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (order.orderStatus !== 'delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }
        const returnReason = String(req.body?.returnReason || '').trim().slice(0, 2000);
        order.orderStatus = 'return_requested';
        if (returnReason) order.cancelReason = returnReason;
        await order.save();
        await appendStatusHistory(order._id, 'return_requested', { note: returnReason || 'Customer requested return' });
        const populated = await EcomOrder.findById(order._id).populate('user', 'name email').lean();
        sendOrderStatusEmail(populated, 'return_requested');
        notifyAllAdmins({
            type: 'return_requested',
            boldName: 'Return requested',
            text: `Return requested for order ${order.orderNumber || String(order._id)}`,
            name: 'Return requested',
            body: `Customer requested a return.${returnReason ? ' Reason: ' + returnReason : ''}`,
            boldTag: 'return',
            subDesc: order.orderNumber || String(order._id),
            tag: 'Orders',
            sender: 'Store',
            initials: 'RT',
            redirectPath: '/order-management',
            meta: { orderId: String(order._id) },
        });
        return res.status(200).json({ success: true, data: { orderStatus: order.orderStatus } });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'return_request_failed' });
    }
};

exports.trackOrder = async (req, res) => {
    try {
        const orderNumber = String(req.query.orderNumber || req.body?.orderNumber || '').trim().toUpperCase();
        const email = String(req.query.email || req.body?.email || '').trim().toLowerCase();
        if (!orderNumber) {
            return res.status(400).json({ success: false, message: 'orderNumber is required' });
        }
        const filter = { orderNumber };
        if (email) {
            filter['shippingAddress.email'] = { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
        }
        const order = await EcomOrder.findOne(filter)
            .select('orderNumber orderStatus paymentStatus paymentMethod trackingUrl shippingAddress.name createdAt updatedAt items')
            .lean();
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found. Please check your order number.' });
        }
        return res.status(200).json({
            success: true,
            data: {
                orderNumber: order.orderNumber,
                orderStatus: order.orderStatus,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                trackingUrl: order.trackingUrl || '',
                customerName: order.shippingAddress?.name || '',
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
                itemCount: Array.isArray(order.items) ? order.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'track_failed' });
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
        const failedEvents = new Set(['payment.failed', 'order.expired']);
        const paymentStatus = paidEvents.has(event) ? 'paid' : failedEvents.has(event) ? 'failed' : 'pending';
        if (paymentStatus === 'pending') {
            return res.status(200).json({ success: true, ignored: true, message: `Ignoring event ${event || 'unknown'}` });
        }

        const orderStatus = paymentStatus === 'paid' ? 'confirmed' : 'cancelled';
        const prev = await EcomOrder.findById(orderId).lean();
        if (!prev) return res.status(404).json({ success: false, message: 'Order not found' });

        if (paymentStatus === 'paid' && isAutoCancelledOrder(prev)) {
            await handleLatePaidOrder(prev, event || 'webhook');
            return res.status(200).json({
                success: true,
                ignored: true,
                message: 'Paid webhook ignored because order was already auto-cancelled',
            });
        }

        if (paymentStatus === 'failed') {
            const cancelled = await markOrderCancelled(orderId, {
                paymentStatus: 'failed',
                cancelReason: prev.cancelReason || 'Payment failed or expired',
                note: `Webhook ${event || ''}`.trim(),
            });
            if (cancelled.error) {
                return res.status(cancelled.error.status).json({ success: false, message: cancelled.error.message });
            }
            notifyAllAdmins({
                type: 'payment_failed',
                boldName: 'Payment failed',
                text: `Payment failed for order ${orderId} (webhook)`,
                name: 'Payment failed',
                body: 'Gateway reported a failed or expired payment. Inventory was released.',
                boldTag: 'webhook',
                subDesc: event || 'payment.failed',
                tag: 'Payments',
                sender: 'Gateway',
                initials: 'PF',
                redirectPath: '/order-management/cancelled',
                dedupeKey: `payment_failed_${orderId}`,
                dedupeWindowMs: 15 * 60 * 1000,
                meta: { orderId: String(orderId), event },
            });
            return res.status(200).json({ success: true, data: cancelled.order });
        }

        const updated = await EcomOrder.findByIdAndUpdate(
            orderId,
            {
                paymentStatus,
                orderStatus,
                paymentMethod: 'online',
                paymentReference: payload?.payment?.entity?.id || payload?.order?.entity?.id || '',
            },
            { new: true }
        ).lean();

        if (String(prev.orderStatus) !== String(orderStatus)) {
            await appendStatusHistory(orderId, orderStatus, { note: `Webhook ${event || ''}`.trim() });
        }

        notifyAllAdmins({
            type: 'payment_success',
            boldName: 'Payment received',
            text: `Payment confirmed for order ${orderId} (webhook)`,
            name: 'Payment received',
            body: 'Gateway captured payment successfully.',
            boldTag: 'paid',
            subDesc: event || 'captured',
            tag: 'Payments',
            sender: 'Gateway',
            initials: 'OK',
            redirectPath: '/order-management',
            dedupeKey: `payment_success_${orderId}`,
            dedupeWindowMs: 15 * 60 * 1000,
            meta: { orderId: String(orderId), event },
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'razorpay_webhook_failed' });
    }
};
