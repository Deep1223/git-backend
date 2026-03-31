/**
 * Public storefront listings always scope to active rows (status: 1),
 * merged with the client's filter using $and (dashboard-style body).
 */
function mergePublicListingRequest(body) {
    const src = body && typeof body === 'object' ? body : {};
    const out = JSON.parse(JSON.stringify(src));

    if (!out.paginationinfo || typeof out.paginationinfo !== 'object') {
        out.paginationinfo = {};
    }

    const pi = out.paginationinfo;
    const rawFilter =
        pi.filter && typeof pi.filter === 'object' && !Array.isArray(pi.filter)
            ? { ...pi.filter }
            : {};

    const statusClause = { status: 1 };
    pi.filter =
        Object.keys(rawFilter).length > 0
            ? { $and: [rawFilter, statusClause] }
            : statusClause;

    if (pi.pageno == null || pi.pageno === '') pi.pageno = 1;
    if (pi.pagelimit == null || pi.pagelimit === '') pi.pagelimit = 20;

    return out;
}

module.exports = { mergePublicListingRequest };
