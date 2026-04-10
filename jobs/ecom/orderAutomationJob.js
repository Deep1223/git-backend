const EcomOrder = require('../../modal/ecomOrder');
const { appendStatusHistory } = require('../../lib/ecomOrderAdminHelpers');
const { sendOrderStatusEmail } = require('../../lib/ecomOrderEmail');
const { notifyAllAdmins } = require('../../lib/adminNotify');
const { markOrderCancelled } = require('../../lib/ecomOrderLifecycle');

const AUTO_CONFIRM_FROM = ['pending', 'processing'];
const AUTO_CANCEL_FROM = ['pending', 'processing'];

function getUnpaidCancelMs() {
    const raw = Number(process.env.ECOM_UNPAID_CANCEL_MS || 30 * 60 * 1000);
    if (!Number.isFinite(raw) || raw <= 0) return 30 * 60 * 1000;
    return raw;
}

async function autoConfirmPaidOrders() {
    const candidates = await EcomOrder.find({
        paymentStatus: 'paid',
        orderStatus: { $in: AUTO_CONFIRM_FROM },
    })
        .populate('user', 'name email')
        .lean();

    let updated = 0;

    for (const order of candidates) {
        const latest = await EcomOrder.findByIdAndUpdate(
            order._id,
            { $set: { orderStatus: 'confirmed' } },
            { new: true }
        )
            .populate('user', 'name email')
            .lean();

        if (!latest) continue;

        await appendStatusHistory(order._id, 'confirmed', {
            note: 'Auto-confirmed after payment received',
        });
        sendOrderStatusEmail(latest, 'confirmed');
        updated += 1;
    }

    if (updated > 0) {
        notifyAllAdmins({
            type: 'orders_auto_confirmed',
            boldName: 'Orders auto-confirmed',
            text: `${updated} paid order(s) were auto-confirmed`,
            name: 'Orders auto-confirmed',
            body: `The order automation job confirmed ${updated} paid order(s) that were still waiting in pending or processing.`,
            boldTag: `${updated} order(s)`,
            subDesc: 'payment already received',
            tag: 'Orders',
            sender: 'Order job',
            initials: 'AC',
            redirectPath: '/order-management/confirmed',
            dedupeKey: `orders_auto_confirmed_${updated}`,
            dedupeWindowMs: 15 * 60 * 1000,
            meta: { updated },
        });
    }

    return updated;
}

async function autoCancelUnpaidOrders() {
    const cancelAfterMs = getUnpaidCancelMs();
    const cutoff = new Date(Date.now() - cancelAfterMs);
    const candidates = await EcomOrder.find({
        paymentMethod: 'online',
        paymentStatus: 'pending',
        orderStatus: { $in: AUTO_CANCEL_FROM },
        createdAt: { $lte: cutoff },
    })
        .populate('user', 'name email')
        .lean();

    let cancelled = 0;

    for (const order of candidates) {
        const result = await markOrderCancelled(order._id, {
            paymentStatus: 'failed',
            autoCancelledAt: new Date(),
            cancelReason: 'Auto-cancelled because payment was not completed in time',
            note: 'Auto-cancelled because payment remained pending',
        });
        if (result?.order) cancelled += 1;
    }

    if (cancelled > 0) {
        notifyAllAdmins({
            type: 'orders_auto_cancelled',
            boldName: 'Orders auto-cancelled',
            text: `${cancelled} unpaid online order(s) were auto-cancelled`,
            name: 'Orders auto-cancelled',
            body: `The order automation job cancelled ${cancelled} online order(s) that stayed unpaid beyond the configured timeout.`,
            boldTag: `${cancelled} order(s)`,
            subDesc: `timeout ${Math.round(cancelAfterMs / 60000)} min`,
            tag: 'Orders',
            sender: 'Order job',
            initials: 'OC',
            redirectPath: '/order-management/pending',
            dedupeKey: `orders_auto_cancelled_${cancelled}_${Math.round(cancelAfterMs / 60000)}`,
            dedupeWindowMs: 15 * 60 * 1000,
            meta: { cancelled, cancelAfterMs },
        });
    }

    return { cancelled, cancelAfterMs };
}

async function runOrderAutomationJob() {
    const [autoConfirmed, cancelSummary] = await Promise.all([
        autoConfirmPaidOrders(),
        autoCancelUnpaidOrders(),
    ]);

    return {
        autoConfirmed,
        autoCancelled: cancelSummary.cancelled,
        unpaidCancelMs: cancelSummary.cancelAfterMs,
    };
}

module.exports = { runOrderAutomationJob };
