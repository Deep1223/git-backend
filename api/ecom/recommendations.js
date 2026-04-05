const EcomOrder = require('../../modal/ecomOrder');
const EcomProduct = require('../../modal/ecomProduct');
const { mapProductPublic, PRODUCT_MASTER_PUBLIC_SELECT } = require('./helpers');

const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 2999);

async function fetchPublicProductsByIds(ids, limit = 8) {
    if (!Array.isArray(ids) || !ids.length) return [];
    const docs = await EcomProduct.find({
        _id: { $in: ids },
        hidden: { $ne: true },
        stock: { $gt: 0 },
    })
        .populate('category', 'name slug')
        .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
        .limit(limit)
        .lean();
    return docs.map(mapProductPublic);
}

exports.frequentlyBoughtTogether = async (req, res) => {
    try {
        const productId = String(req.query.productId || req.body?.productId || '');
        if (!productId) return res.status(400).json({ success: false, message: 'productId required' });
        const orders = await EcomOrder.find({ 'items.product': productId }).select('items.product').limit(120).lean();
        const counts = new Map();
        for (const order of orders) {
            for (const item of order.items || []) {
                const id = String(item.product);
                if (id === productId) continue;
                counts.set(id, (counts.get(id) || 0) + 1);
            }
        }
        const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
        return res.status(200).json({ success: true, data: await fetchPublicProductsByIds(ids) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'fbt_failed' });
    }
};

exports.similarProducts = async (req, res) => {
    try {
        const productId = String(req.query.productId || req.body?.productId || '');
        const product = await EcomProduct.findById(productId)
            .populate('category', 'slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .lean();
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        const refPrice = mapProductPublic(product).price;
        const min = Math.max(0, refPrice * 0.7);
        const max = refPrice * 1.3;
        const docs = await EcomProduct.find({
            _id: { $ne: product._id },
            category: product.category?._id,
            price: { $gte: min, $lte: max },
            tags: { $in: product.tags || [] },
            hidden: { $ne: true },
            stock: { $gt: 0 },
        })
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .limit(8)
            .lean();
        return res.status(200).json({ success: true, data: docs.map(mapProductPublic) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'similar_failed' });
    }
};

exports.completeTheLook = async (req, res) => {
    try {
        const productId = String(req.query.productId || req.body?.productId || '');
        const relations = {
            ring: ['bracelet', 'earrings'],
            necklace: ['earrings', 'bracelet'],
            earrings: ['necklace', 'ring'],
            bracelet: ['ring', 'necklace'],
        };
        const product = await EcomProduct.findById(productId)
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .lean();
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        const nextTags = (product.tags || []).flatMap((tag) => relations[tag] || []);
        if (!nextTags.length) return res.status(200).json({ success: true, data: [] });
        const docs = await EcomProduct.find({
            _id: { $ne: product._id },
            tags: { $in: nextTags },
            hidden: { $ne: true },
            stock: { $gt: 0 },
        })
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .limit(8)
            .lean();
        return res.status(200).json({ success: true, data: docs.map(mapProductPublic) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'complete_look_failed' });
    }
};

exports.cartUpsell = async (req, res) => {
    try {
        const cartTotal = Number(req.query.cartTotal || req.body?.cartTotal || 0);
        const missingAmount = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotal);
        const docs = await EcomProduct.find({
            stock: { $gt: 0 },
            hidden: { $ne: true },
            price: { $lte: Math.max(missingAmount + 500, 1000) },
        })
            .populate('category', 'name slug')
            .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
            .sort({ price: 1 })
            .limit(8)
            .lean();
        return res.status(200).json({
            success: true,
            data: {
                threshold: FREE_SHIPPING_THRESHOLD,
                missingAmount,
                products: docs.map(mapProductPublic),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'cart_upsell_failed' });
    }
};
