const { getAllSubCategories } = require('../api/subcategorymaster');
const { mergePublicListingRequest } = require('./mergePublicListingBody');

/**
 * POST /api/public/subcategories
 * Body: { paginationinfo, searchtext } — same as dashboard /api/subcategorymaster POST.
 */
exports.postPublicSubcategories = async (req, res) => {
    const mergedBody = mergePublicListingRequest(req.body);
    const shadowReq = { ...req, body: mergedBody };
    return getAllSubCategories(shadowReq, res);
};
