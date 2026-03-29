const { getAllCategories } = require('../api/categorymaster');
const { mergePublicListingRequest } = require('./mergePublicListingBody');

/**
 * POST /api/public/categories
 * Body: { paginationinfo, searchtext } — same shape as dashboard /api/category POST.
 * Filter is always ANDed with { status: 1 }.
 */
exports.postPublicCategories = async (req, res) => {
    const mergedBody = mergePublicListingRequest(req.body);
    const shadowReq = { ...req, body: mergedBody };
    return getAllCategories(shadowReq, res);
};
