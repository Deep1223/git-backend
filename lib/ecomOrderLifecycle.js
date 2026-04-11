const EcomOrder = require('../modal/ecomOrder');
const EcomProduct = require('../modal/ecomProduct');
const { appendStatusHistory } = require('./ecomOrderAdminHelpers');
const { sendOrderStatusEmail } = require('./ecomOrderEmail');
const { mirrorAvailableQtyFromEcomProduct } = require('./catalogProductMasterSync');

async function loadOrder(orderOrId) {
    if (orderOrId && typeof orderOrId === 'object' && orderOrId._id) return orderOrId;
    if (!orderOrId) return null;
    return EcomOrder.findById(orderOrId).lean();
}

async function restoreInventoryForOrder(orderOrId) {
    const order = await loadOrder(orderOrId);
    if (!order) return { ok: false, restored: false, reason: 'order_not_found' };
    if (order.inventoryRestoredAt) {
        return { ok: true, restored: false, reason: 'already_restored', inventoryRestoredAt: order.inventoryRestoredAt };
    }

    for (const item of order.items || []) {
        if (!item?.product) continue;
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        if (!qty) continue;

        await EcomProduct.updateOne(
            { _id: item.product },
            [
                {
                    $set: {
                        stock: { $max: [0, { $add: [{ $ifNull: ['$stock', 0] }, qty] }] },
                        recentSalesCount: { $max: [0, { $subtract: [{ $ifNull: ['$recentSalesCount', 0] }, qty] }] },
                    },
                },
            ]
        );
        await mirrorAvailableQtyFromEcomProduct(item.product);
    }

    const inventoryRestoredAt = new Date();
    await EcomOrder.findByIdAndUpdate(order._id, { $set: { inventoryRestoredAt } });
    return { ok: true, restored: true, inventoryRestoredAt };
}

async function markOrderCancelled(orderId, options = {}) {
    const prev = await EcomOrder.findById(orderId).lean();
    if (!prev) {
        return { error: { status: 404, message: 'Order not found' } };
    }

    if (String(prev.orderStatus) === 'cancelled') {
        const existing = await EcomOrder.findById(orderId).populate('user', 'name email').lean();
        return { order: existing, changed: false, inventoryRestored: false };
    }

    const set = {
        orderStatus: 'cancelled',
        cancelReason: String(options.cancelReason || prev.cancelReason || '').slice(0, 2000),
    };
    if (options.paymentStatus) set.paymentStatus = String(options.paymentStatus);
    if (options.autoCancelledAt) set.autoCancelledAt = options.autoCancelledAt;

    const updated = await EcomOrder.findByIdAndUpdate(orderId, { $set: set }, { new: true })
        .populate('user', 'name email')
        .lean();

    const inventoryResult = await restoreInventoryForOrder(updated);
    if (inventoryResult?.inventoryRestoredAt) {
        updated.inventoryRestoredAt = inventoryResult.inventoryRestoredAt;
    }
    await appendStatusHistory(orderId, 'cancelled', {
        userId: options.userId || '',
        note: options.note || '',
    });
    sendOrderStatusEmail(updated, 'cancelled');

    return {
        order: updated,
        changed: true,
        inventoryRestored: Boolean(inventoryResult?.restored),
    };
}

module.exports = {
    restoreInventoryForOrder,
    markOrderCancelled,
};
