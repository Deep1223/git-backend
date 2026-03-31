const { getAllProducts } = require('../api/productmaster');
const { mergePublicProductListing } = require('./mergePublicProductListing');

/**
 * POST /api/public/products
 * Body: { paginationinfo, searchtext } — same as dashboard /api/productmaster POST.
 */
exports.postPublicProducts = async (req, res) => {
    const mergedBody = mergePublicProductListing(req.body);
    const shadowReq = { ...req, body: mergedBody };
    return getAllProducts(shadowReq, res);
};
