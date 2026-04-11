const EcomSequence = require('../modal/ecomSequence');
const EcomOrderStatusHistory = require('../modal/ecomOrderStatusHistory');

const SEQUENCE_KEY = 'ecomOrderNumber';

/**
 * Maps legacy status to the canonical value used in filters and UI.
 * @param {string} s
 */
function normalizeOrderStatus(s) {
    const v = String(s || '').trim();
    if (v === 'processing') return 'pending';
    return v;
}

/**
 * @param {string} orderId
 * @param {string} status
 * @param {{ userId?: string, note?: string }} meta
 */
async function appendStatusHistory(orderId, status, meta = {}) {
    await EcomOrderStatusHistory.create({
        order: orderId,
        status,
        changedBy: meta.userId ? String(meta.userId) : '',
        note: meta.note || '',
    });
}

async function allocateOrderNumber() {
    const doc = await EcomSequence.findOneAndUpdate(
        { key: SEQUENCE_KEY },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    ).lean();
    const n = doc?.seq || 1;
    return `ORN${String(n).padStart(6, '0')}`;
}

module.exports = {
    normalizeOrderStatus,
    appendStatusHistory,
    allocateOrderNumber,
};
