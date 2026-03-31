const { mergePublicListingRequest } = require('./mergePublicListingBody');

/** Only list products that can be sold (in stock with quantity or legacy instock flag). */
function publicProductStockClause() {
    return {
        $or: [
            { availableQty: { $gt: 0 } },
            { availableQty: { $exists: false }, instock: 1 },
        ],
    };
}

/**
 * Dashboard-style POST body + active status + sellable stock for storefront products.
 */
function mergePublicProductListing(body) {
    const out = mergePublicListingRequest(body);
    const pi = out.paginationinfo;
    const stockQ = publicProductStockClause();
    const f = pi.filter;

    if (f && f.$and && Array.isArray(f.$and)) {
        pi.filter = { $and: [...f.$and, stockQ] };
    } else if (f && typeof f === 'object' && Object.keys(f).length > 0) {
        pi.filter = { $and: [f, stockQ] };
    } else {
        pi.filter = stockQ;
    }

    return out;
}

module.exports = {
    mergePublicProductListing,
    publicProductStockClause,
};
