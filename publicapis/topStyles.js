const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const CategoryMaster = require('../modal/categorymaster');
const { slugifyLabel } = require('../lib/slugifyLabel');
const { publicProductStockClause } = require('./mergePublicProductListing');

const MAX_LIMIT = 48;
const MAX_CURATED = 50;

/**
 * Resolve CategoryMaster _id for a storefront tab slug (e.g. necklaces, men).
 */
async function findCategoryIdForTabSlug(tabSlug) {
    const t = String(tabSlug || '')
        .trim()
        .toLowerCase();
    if (!t || t === 'all') return null;

    const cats = await CategoryMaster.find({ status: 1 }).select('_id categoryname').lean();

    for (const c of cats) {
        if (slugifyLabel(c.categoryname) === t) {
            return c._id;
        }
    }

    const aliases = [
        ['mens', 'men'],
        ['men', 'mens'],
    ];
    for (const [a, b] of aliases) {
        if (t !== a && t !== b) continue;
        for (const c of cats) {
            const s = slugifyLabel(c.categoryname);
            if (s === 'men' || s === 'mens') return c._id;
        }
    }

    return null;
}

function resolveTopStylesSort(paginationinfo) {
    const incomingSort = paginationinfo?.sort || {};
    if (incomingSort?.field) {
        const fieldFromRequest =
            incomingSort.field === 'createdAt'
                ? 'recordinfo.createat'
                : incomingSort.field === 'updatedAt'
                  ? 'recordinfo.updateat'
                  : incomingSort.field;
        const orderFromRequest = Number(incomingSort.order);
        if (
            fieldFromRequest &&
            (orderFromRequest === 1 || orderFromRequest === -1)
        ) {
            return { [fieldFromRequest]: orderFromRequest };
        }
    }
    const sortEntries = Object.entries(incomingSort);
    if (sortEntries.length === 0) {
        return { 'recordinfo.createat': -1 };
    }
    const [rawField, rawOrder] = sortEntries[0];
    const mappedField =
        rawField === 'createdAt'
            ? 'recordinfo.createat'
            : rawField === 'updatedAt'
              ? 'recordinfo.updateat'
              : rawField;
    const mappedOrder = Number(rawOrder);
    if (mappedField && (mappedOrder === 1 || mappedOrder === -1)) {
        return { [mappedField]: mappedOrder };
    }
    return { 'recordinfo.createat': -1 };
}

/**
 * POST /api/public/top-styles
 *
 * Body (dashboard-style):
 * {
 *   paginationinfo: {
 *     filter: { tab: "all" | "necklaces" | ... },
 *     pageno: 1,
 *     pagelimit: 8,
 *     sort: { field: "recordinfo.createat", order: -1 } | {}
 *   },
 *   searchtext: ""
 * }
 *
 * Supports typo `pagno` as alias for `pageno`.
 * Legacy flat { tab, limit, pageno } still accepted.
 */
exports.postPublicTopStyles = async (req, res) => {
    try {
        const body = req.body || {};
        let paginationinfo = body.paginationinfo;

        if (
            !paginationinfo &&
            (body.tab != null || body.limit != null || body.pageno != null)
        ) {
            paginationinfo = {
                pageno: body.pageno,
                pagelimit: body.limit,
                filter: { tab: body.tab != null ? String(body.tab) : 'all' },
                sort: {},
            };
        }

        paginationinfo =
            paginationinfo && typeof paginationinfo === 'object'
                ? paginationinfo
                : {};
        const searchtext =
            typeof body.searchtext === 'string' ? body.searchtext.trim() : '';

        const rawFilter =
            paginationinfo.filter &&
            typeof paginationinfo.filter === 'object' &&
            !Array.isArray(paginationinfo.filter)
                ? { ...paginationinfo.filter }
                : {};

        const productIdsRaw = rawFilter.productIds;
        delete rawFilter.productIds;

        const tabRaw = rawFilter.tab != null ? String(rawFilter.tab) : 'all';
        const tab = tabRaw.trim().toLowerCase() || 'all';
        delete rawFilter.tab;
        const extraMongoFilter = rawFilter;
        const hasExtra = Object.keys(extraMongoFilter).length > 0;

        /** Curated list from Product Master (dashboard Top Styles — up to 50 IDs, order preserved). */
        if (Array.isArray(productIdsRaw) && productIdsRaw.length > 0) {
            const idStrings = [
                ...new Set(
                    productIdsRaw
                        .map((x) => String(x || '').trim())
                        .filter((id) => mongoose.Types.ObjectId.isValid(id))
                ),
            ].slice(0, MAX_CURATED);
            if (idStrings.length === 0) {
                return res.status(200).json({
                    success: true,
                    totalCount: 0,
                    count: 0,
                    data: [],
                    tab: 'all',
                });
            }
            const objectIds = idStrings.map((id) => new mongoose.Types.ObjectId(id));
            const parts = [{ status: 1 }, publicProductStockClause(), { _id: { $in: objectIds } }];
            const filter = { $and: parts };
            const found = await ProductMaster.find(filter).lean();
            const map = new Map(found.map((p) => [String(p._id), p]));
            const ordered = idStrings.map((id) => map.get(id)).filter(Boolean);
            return res.status(200).json({
                success: true,
                totalCount: ordered.length,
                count: ordered.length,
                data: ordered,
                tab: 'all',
            });
        }

        let pageno = Number(
            paginationinfo.pageno != null
                ? paginationinfo.pageno
                : paginationinfo.pagno
        );
        if (!Number.isFinite(pageno) || pageno < 1) pageno = 1;

        let limit = Number(paginationinfo.pagelimit);
        if (!Number.isFinite(limit) || limit < 1) limit = 8;
        limit = Math.min(Math.floor(limit), MAX_LIMIT);

        const skip = (pageno - 1) * limit;
        const sort = resolveTopStylesSort(paginationinfo);

        const parts = [{ status: 1 }, publicProductStockClause()];

        if (tab !== 'all') {
            const catId = await findCategoryIdForTabSlug(tab);
            if (!catId) {
                return res.status(200).json({
                    success: true,
                    totalCount: 0,
                    count: 0,
                    data: [],
                    tab,
                });
            }
            const catDoc = await CategoryMaster.findById(catId)
                .select('categoryname')
                .lean();
            const name = catDoc?.categoryname?.trim();
            if (name && name.length > 0) {
                parts.push({
                    $or: [{ categoryid: catId }, { category: name }],
                });
            } else {
                parts.push({ categoryid: catId });
            }
        }

        if (hasExtra) {
            parts.push(extraMongoFilter);
        }

        if (searchtext) {
            parts.push({
                $or: [
                    { productname: { $regex: searchtext, $options: 'i' } },
                    { productseries: { $regex: searchtext, $options: 'i' } },
                    { category: { $regex: searchtext, $options: 'i' } },
                    { subcategory: { $regex: searchtext, $options: 'i' } },
                    { description: { $regex: searchtext, $options: 'i' } },
                    { material: { $regex: searchtext, $options: 'i' } },
                ],
            });
        }

        const filter = parts.length === 1 ? parts[0] : { $and: parts };

        const products = await ProductMaster.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalCount = await ProductMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: products.length,
            data: products,
            tab,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to load top styles',
        });
    }
};
