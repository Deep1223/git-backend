/* eslint-disable no-console */
const assert = require('assert');
const mongoose = require('mongoose');
const dotenv = require('dotenv-vault');
const EcomCategory = require('../modal/ecomCategory');
const EcomProduct = require('../modal/ecomProduct');
const EcomOrder = require('../modal/ecomOrder');
const EcomOrderStatusHistory = require('../modal/ecomOrderStatusHistory');
const { runOrderAutomationJob } = require('../jobs/ecom/orderAutomationJob');

dotenv.config();

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    const suffix = Date.now();
    const slug = `automation-test-${suffix}`;
    const orderNumberBase = `TEST${suffix}`;

    try {
        const category = await EcomCategory.create({
            name: `Automation Test ${suffix}`,
            slug,
        });

        const [confirmProduct, cancelProduct, recentProduct] = await Promise.all([
            EcomProduct.create({
                name: `Confirm Product ${suffix}`,
                slug: `confirm-${slug}`,
                category: category._id,
                price: 100,
                stock: 8,
            }),
            EcomProduct.create({
                name: `Cancel Product ${suffix}`,
                slug: `cancel-${slug}`,
                category: category._id,
                price: 100,
                stock: 4,
            }),
            EcomProduct.create({
                name: `Recent Product ${suffix}`,
                slug: `recent-${slug}`,
                category: category._id,
                price: 100,
                stock: 6,
            }),
        ]);

        const [paidPendingOrder, oldUnpaidOrder, recentUnpaidOrder] = await Promise.all([
            EcomOrder.create({
                orderNumber: `${orderNumberBase}-1`,
                items: [{ product: confirmProduct._id, name: 'Confirm Product', quantity: 1, price: 100 }],
                totalAmount: 100,
                subtotalAmount: 100,
                paymentMethod: 'online',
                paymentStatus: 'paid',
                orderStatus: 'pending',
            }),
            EcomOrder.create({
                orderNumber: `${orderNumberBase}-2`,
                items: [{ product: cancelProduct._id, name: 'Cancel Product', quantity: 1, price: 100 }],
                totalAmount: 100,
                subtotalAmount: 100,
                paymentMethod: 'online',
                paymentStatus: 'pending',
                orderStatus: 'pending',
            }),
            EcomOrder.create({
                orderNumber: `${orderNumberBase}-3`,
                items: [{ product: recentProduct._id, name: 'Recent Product', quantity: 1, price: 100 }],
                totalAmount: 100,
                subtotalAmount: 100,
                paymentMethod: 'online',
                paymentStatus: 'pending',
                orderStatus: 'pending',
            }),
        ]);

        await EcomOrder.findByIdAndUpdate(oldUnpaidOrder._id, {
            $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        });

        process.env.ECOM_UNPAID_CANCEL_MS = String(30 * 60 * 1000);

        const firstRun = await runOrderAutomationJob();
        assert.strictEqual(firstRun.autoConfirmed, 1, 'paid pending order should auto-confirm');
        assert.strictEqual(firstRun.autoCancelled, 1, 'old unpaid order should auto-cancel');

        const [confirmedAfter, cancelledAfter, recentAfter] = await Promise.all([
            EcomOrder.findById(paidPendingOrder._id).lean(),
            EcomOrder.findById(oldUnpaidOrder._id).lean(),
            EcomOrder.findById(recentUnpaidOrder._id).lean(),
        ]);

        assert.strictEqual(confirmedAfter.orderStatus, 'confirmed', 'paid pending order should become confirmed');
        assert.strictEqual(cancelledAfter.orderStatus, 'cancelled', 'old unpaid order should become cancelled');
        assert.strictEqual(cancelledAfter.paymentStatus, 'failed', 'old unpaid order should move out of pending');
        assert.ok(cancelledAfter.inventoryRestoredAt, 'cancelled order should record inventory restore time');
        assert.ok(cancelledAfter.autoCancelledAt, 'cancelled order should record auto-cancel time');
        assert.strictEqual(recentAfter.orderStatus, 'pending', 'recent unpaid order should stay pending');

        const cancelProductAfter = await EcomProduct.findById(cancelProduct._id).lean();
        assert.strictEqual(cancelProductAfter.stock, 5, 'cancelled order stock should be restored exactly once');

        const cancelledHistoryCountBefore = await EcomOrderStatusHistory.countDocuments({
            order: oldUnpaidOrder._id,
            status: 'cancelled',
        });

        const secondRun = await runOrderAutomationJob();
        assert.strictEqual(secondRun.autoCancelled, 0, 'second run should not cancel same order again');

        const cancelProductAfterSecondRun = await EcomProduct.findById(cancelProduct._id).lean();
        const cancelledHistoryCountAfter = await EcomOrderStatusHistory.countDocuments({
            order: oldUnpaidOrder._id,
            status: 'cancelled',
        });

        assert.strictEqual(cancelProductAfterSecondRun.stock, 5, 'duplicate run should not restore stock twice');
        assert.strictEqual(cancelledHistoryCountAfter, cancelledHistoryCountBefore, 'duplicate run should not append duplicate cancelled history');

        console.log('[test-order-automation] PASSED');
    } finally {
        await Promise.all([
            EcomOrder.deleteMany({ orderNumber: new RegExp(`^${orderNumberBase}`) }),
            EcomProduct.deleteMany({ slug: { $in: [`confirm-${slug}`, `cancel-${slug}`, `recent-${slug}`] } }),
            EcomCategory.deleteMany({ slug }),
        ]);
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('[test-order-automation] FAILED:', error.message);
    process.exit(1);
});
