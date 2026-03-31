const EcomStorefrontSection = require('../../modal/ecomStorefrontSection');
const EcomProduct = require('../../modal/ecomProduct');

const RULES = {
    'top-styles': { sort: { recentSalesCount: -1, updatedAt: -1 }, limit: 8 },
    trending: { sort: { views: -1, recentSalesCount: -1, updatedAt: -1 }, limit: 8 },
    recommended: { sort: { 'metadata.score': -1, updatedAt: -1 }, limit: 8 },
    'new-arrivals': { sort: { createdAt: -1 }, limit: 8 },
};

async function runStorefrontAutoBuilderJob() {
    const entries = Object.entries(RULES);
    for (const [key, rule] of entries) {
        const section = await EcomStorefrontSection.findOne({ key });
        if (section && section.mode === 'custom') continue;
        const docs = await EcomProduct.find({ hidden: { $ne: true }, stock: { $gt: 0 } })
            .sort(rule.sort)
            .limit(rule.limit)
            .select('_id')
            .lean();
        await EcomStorefrontSection.findOneAndUpdate(
            { key },
            {
                mode: 'auto',
                products: docs.map((d) => d._id),
                ruleConfig: { ...(section?.ruleConfig || {}), limit: rule.limit },
            },
            { upsert: true }
        );
    }
    return { updatedSections: entries.length };
}

module.exports = { runStorefrontAutoBuilderJob };
