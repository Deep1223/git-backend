const EcomOrder = require('../../modal/ecomOrder');
const EcomProduct = require('../../modal/ecomProduct');

async function runBestsellerJob() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await EcomOrder.aggregate([
        { $match: { createdAt: { $gte: since }, paymentStatus: { $in: ['pending', 'paid'] } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', sold: { $sum: '$items.quantity' } } },
    ]);

    const ids = rows.map((r) => r._id);
    await EcomProduct.updateMany({}, { $set: { recentSalesCount: 0 } });
    for (const row of rows) {
        await EcomProduct.findByIdAndUpdate(row._id, {
            $set: {
                recentSalesCount: row.sold,
                'metadata.isTopStyle': row.sold > 0,
                'metadata.score': row.sold,
            },
        });
    }
    return { updatedProducts: ids.length };
}

module.exports = { runBestsellerJob };
