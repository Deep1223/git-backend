const { getAllProducts } = require('../api/productmaster');
const { mergePublicListingRequest } = require('./mergePublicListingBody');

/**
 * POST /api/public/products
 * Body: { paginationinfo, searchtext } — same as dashboard /api/productmaster POST.
 */
exports.postPublicProducts = async (req, res) => {
    const mergedBody = mergePublicListingRequest(req.body);
    const shadowReq = { ...req, body: mergedBody };
    return getAllProducts(shadowReq, res);
};
