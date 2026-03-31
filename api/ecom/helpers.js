const EcomProduct = require('../../modal/ecomProduct');

function getSessionId(req) {
    const fromHeader = req.headers['x-session-id'];
    const fromQuery = req.query?.sessionId;
    const fromBody = req.body?.sessionId;
    const value = fromHeader || fromQuery || fromBody || null;
    return value ? String(value) : null;
}

function resolveActor(req) {
    return {
        userId: req.ecomUser?._id || null,
        sessionId: getSessionId(req),
    };
}

function mapProductPublic(product) {
    return {
        id: String(product._id),
        name: product.name,
        slug: product.slug,
        price: product.price,
        originalPrice: product.originalPrice,
        category: product.category?.slug || product.category,
        categoryName: product.category?.name || '',
        image: product.images?.[0] || '',
        images: product.images || [],
        stock: product.stock,
        tags: product.tags || [],
        inStock: product.stock > 0,
        isLowStock: Boolean(product.isLowStock),
    };
}

async function loadProductsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const docs = await EcomProduct.find({ _id: { $in: ids }, hidden: { $ne: true } })
        .populate('category', 'name slug')
        .lean();
    const order = new Map(ids.map((id, index) => [String(id), index]));
    return docs
        .sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))
        .map(mapProductPublic);
}

module.exports = {
    getSessionId,
    resolveActor,
    mapProductPublic,
    loadProductsByIds,
};
