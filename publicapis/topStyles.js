const mongoose = require('mongoose');
const ProductMaster = require('../modal/productmaster');
const CategoryMaster = require('../modal/categorymaster');
const { slugifyLabel } = require('../lib/slugifyLabel');

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
 */
exports.postPublicTopStyles = async (req, res) => {
    try {
        const body = req.body || {};
        let paginationinfo = body.paginationinfo || {};

        const page = Math.max(1, Number(paginationinfo.pageno || 1));
        const limit = Math.max(1, Math.min(48, Number(paginationinfo.pagelimit || 8)));
        const skip = (page - 1) * limit;

        const filter = { status: 1 };
        
        // Tab-based category filter
        const categoryId = await findCategoryIdForTabSlug(paginationinfo.filter?.tab);
        if (categoryId) {
            filter.categoryid = categoryId;
        }

        // Section filter (Top Styles)
        filter.storefrontHomeSectionKeys = { $in: ['topStylesProducts'] };

        const sort = resolveTopStylesSort(paginationinfo);

        const products = await ProductMaster.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .select('productseries productname price originalPrice images availableQty category categoryid storefrontHomeSectionKeys')
            .lean();

        const totalCount = await ProductMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: products.length,
            data: products.map(p => ({
                id: String(p._id),
                name: p.productname,
                price: p.price,
                originalPrice: p.originalPrice,
                image: p.images?.[0] || '',
                storefrontHomeSectionKeys: Array.isArray(p.storefrontHomeSectionKeys)
                    ? p.storefrontHomeSectionKeys.map((k) => String(k).trim()).filter(Boolean)
                    : [],
                categoryId: p.categoryid ? String(p.categoryid) : '',
                category: p.category,
                inStock: p.availableQty > 0,
                stockLeft: p.availableQty
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
