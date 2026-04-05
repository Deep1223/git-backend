const EcomStorefrontSection = require('../../modal/ecomStorefrontSection');
const EcomProduct = require('../../modal/ecomProduct');
const { loadProductsByIds, mapProductPublic, PRODUCT_MASTER_PUBLIC_SELECT } = require('./helpers');

const SECTION_KEYS = ['top-styles', 'trending', 'recommended', 'new-arrivals'];

async function buildAutoProducts(sectionKey, ruleConfig = {}) {
    const limit = Math.min(24, Math.max(1, Number(ruleConfig.limit || 8)));
    const minStock = Math.max(0, Number(ruleConfig.minStock || 1));
    const common = { hidden: { $ne: true }, stock: { $gte: minStock } };

    const pop = (q) =>
        q.populate('category', 'name slug').populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT);

    if (sectionKey === 'trending' || sectionKey === 'recommended' || sectionKey === 'top-styles') {
        const manualKey = 
            sectionKey === 'trending' ? 'trendingProducts' : 
            sectionKey === 'recommended' ? 'recommendedProducts' : 
            'topStylesProducts';

        const pipeline = [
            { $match: common },
            {
                $lookup: {
                    from: 'productmasters',
                    localField: 'productMasterId',
                    foreignField: '_id',
                    as: 'pm',
                },
            },
            { $unwind: { path: '$pm', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    isManual: {
                        $cond: {
                            if: {
                                $in: [
                                    manualKey,
                                    { $ifNull: ['$pm.storefrontHomeSectionKeys', []] },
                                ],
                            },
                            then: 1,
                            else: 0,
                        },
                    },
                    hasProductMaster: { $cond: [{ $ifNull: ['$productMasterId', false] }, 1, 0] }
                },
            },
            {
                $sort: {
                    isManual: -1,
                    hasProductMaster: -1,
                    recentSalesCount: -1,
                    'metadata.score': -1,
                    views: -1,
                    updatedAt: -1,
                },
            },
            { $limit: limit },
        ];
        const docs = await EcomProduct.aggregate(pipeline);
        return EcomProduct.populate(docs, [
            { path: 'category', select: 'name slug' },
            { path: 'productMasterId', select: PRODUCT_MASTER_PUBLIC_SELECT },
        ]);
    }
    return pop(EcomProduct.find(common).sort({ createdAt: -1 }).limit(limit)).lean();
}

async function getSection(sectionKey) {
    let section = await EcomStorefrontSection.findOne({ key: sectionKey }).lean();
    if (!section) {
        section = await EcomStorefrontSection.create({ key: sectionKey, mode: 'auto', products: [] });
        section = section.toObject();
    }

    if (section.mode === 'custom') {
        const products = await loadProductsByIds(section.products || []);
        const hiddenSet = new Set((section.hiddenProducts || []).map((id) => String(id)));
        return {
            key: sectionKey,
            mode: section.mode,
            tooltip: 'Custom section with manual override',
            products: products.filter((p) => !hiddenSet.has(String(p.id))),
        };
    }

    const autoDocs = await buildAutoProducts(sectionKey, section.ruleConfig || {});
    const hiddenSet = new Set((section.hiddenProducts || []).map((id) => String(id)));
    return {
        key: sectionKey,
        mode: 'auto',
        tooltip: 'Based on last 7 days sales and activity',
        products: autoDocs
            .map(mapProductPublic)
            .filter((p) => !hiddenSet.has(String(p.id))),
    };
}

exports.getTopStyles = async (_req, res) => {
    try {
        return res.status(200).json({ success: true, data: await getSection('top-styles') });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'top_styles_failed' });
    }
};

exports.getTrending = async (_req, res) => {
    try {
        return res.status(200).json({ success: true, data: await getSection('trending') });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'trending_failed' });
    }
};

exports.getRecommended = async (_req, res) => {
    try {
        return res.status(200).json({ success: true, data: await getSection('recommended') });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'recommended_failed' });
    }
};

exports.getHomeSections = async (_req, res) => {
    try {
        const sections = await Promise.all(SECTION_KEYS.map((key) => getSection(key)));
        return res.status(200).json({ success: true, data: sections });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'home_sections_failed' });
    }
};

exports.upsertSectionControl = async (req, res) => {
    try {
        const key = req.params.key;
        if (!SECTION_KEYS.includes(key)) {
            return res.status(400).json({ success: false, message: 'Invalid section key' });
        }
        const payload = req.body || {};
        const update = {
            mode: payload.mode === 'custom' ? 'custom' : 'auto',
            products: Array.isArray(payload.products) ? payload.products : undefined,
            hiddenProducts: Array.isArray(payload.hiddenProducts) ? payload.hiddenProducts : undefined,
            ruleConfig: payload.ruleConfig && typeof payload.ruleConfig === 'object' ? payload.ruleConfig : undefined,
            note: payload.note != null ? String(payload.note) : undefined,
        };
        Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
        await EcomStorefrontSection.findOneAndUpdate({ key }, update, { upsert: true, new: true });
        return res.status(200).json({ success: true, data: await getSection(key) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'section_update_failed' });
    }
};
