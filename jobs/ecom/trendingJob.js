const EcomProduct = require('../../modal/ecomProduct');

async function runTrendingJob() {
    const top = await EcomProduct.find({ hidden: { $ne: true } })
        .sort({ views: -1, recentSalesCount: -1, updatedAt: -1 })
        .limit(20)
        .select('_id')
        .lean();
    const ids = new Set(top.map((p) => String(p._id)));
    const all = await EcomProduct.find({ hidden: { $ne: true } }).select('_id').lean();
    for (const p of all) {
        await EcomProduct.findByIdAndUpdate(p._id, { $set: { 'metadata.isTrending': ids.has(String(p._id)) } });
    }
    return { trendingCount: ids.size };
}

module.exports = { runTrendingJob };
