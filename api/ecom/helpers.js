const EcomProduct = require('../../modal/ecomProduct');

/** Populate `productMasterId` with these fields wherever products are returned to the storefront. */
const PRODUCT_MASTER_PUBLIC_SELECT = 'productseries productname price originalPrice images availableQty';

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
    const pm =
        product.productMasterId && typeof product.productMasterId === 'object'
            ? product.productMasterId
            : null;
    const name =
        pm != null && pm.productname != null && String(pm.productname).trim()
            ? String(pm.productname).trim()
            : product.name;
    const price =
        pm != null && Number.isFinite(Number(pm.price)) ? Number(pm.price) : Number(product.price) || 0;
    const originalPrice =
        pm != null && Number.isFinite(Number(pm.originalPrice))
            ? Number(pm.originalPrice)
            : Number(product.originalPrice) || 0;
    const pmImgs = Array.isArray(pm?.images)
        ? pm.images.filter((u) => u != null && String(u).trim() !== '')
        : [];
    const images = pmImgs.length ? pmImgs : Array.isArray(product.images) ? product.images : [];
    const stock =
        pm != null && Number.isFinite(Number(pm.availableQty))
            ? Math.max(0, Math.floor(Number(pm.availableQty)))
            : Math.max(0, Math.floor(Number(product.stock) || 0));
    return {
        id: String(product._id),
        name,
        slug: product.slug,
        productSeries: pm?.productseries ? String(pm.productseries) : '',
        price,
        originalPrice,
        category: product.category?.slug || product.category,
        categoryName: product.category?.name || '',
        image: images[0] || '',
        images,
        stock,
        tags: product.tags || [],
        inStock: stock > 0,
        isLowStock: Boolean(product.isLowStock),
    };
}

async function loadProductsByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const docs = await EcomProduct.find({ _id: { $in: ids }, hidden: { $ne: true } })
        .populate('category', 'name slug')
        .populate('productMasterId', PRODUCT_MASTER_PUBLIC_SELECT)
        .lean();
    const order = new Map(ids.map((id, index) => [String(id), index]));
    return docs
        .sort((a, b) => (order.get(String(a._id)) ?? 0) - (order.get(String(b._id)) ?? 0))
        .map(mapProductPublic);
}

module.exports = {
    PRODUCT_MASTER_PUBLIC_SELECT,
    getSessionId,
    resolveActor,
    mapProductPublic,
    loadProductsByIds,
};
