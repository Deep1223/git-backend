const StorefrontReview = require('../modal/storefrontreview');

function mapSort(incomingSort) {
    if (incomingSort?.field) {
        const field = incomingSort.field;
        const order = Number(incomingSort.order);
        if (field && (order === 1 || order === -1)) return { [field]: order };
    }
    const entries = Object.entries(incomingSort || {});
    if (entries.length) {
        const [field, rawOrder] = entries[0];
        const order = Number(rawOrder);
        if (field && (order === 1 || order === -1)) return { [field]: order };
    }
    return { createdAt: -1 };
}

function parseListRequest(body = {}) {
    const paginationinfo = body.paginationinfo || {};
    const pageno = Math.max(1, Number(paginationinfo.pageno) || 1);
    const pagelimit = Math.max(1, Number(paginationinfo.pagelimit) || 20);
    const skip = (pageno - 1) * pagelimit;
    const sort = mapSort(paginationinfo.sort || {});
    const searchtext = String(body.searchtext || '').trim();
    const filter = { ...(paginationinfo.filter || {}) };
    return { filter, searchtext, sort, skip, limit: pagelimit };
}

function buildQuery(filter = {}, searchtext = '', { publishedOnly = false } = {}) {
    const query = {};

    if (publishedOnly) {
        query.status = 1;
    } else if (filter.status !== undefined && filter.status !== null && filter.status !== '') {
        const status = Number(filter.status);
        if (Number.isFinite(status)) query.status = status;
    }

    if (filter.productId) {
        query.productId = String(filter.productId).trim();
    }

    if (searchtext) {
        query.$or = [
            { reviewerName: { $regex: searchtext, $options: 'i' } },
            { productName: { $regex: searchtext, $options: 'i' } },
            { title: { $regex: searchtext, $options: 'i' } },
            { text: { $regex: searchtext, $options: 'i' } },
            { source: { $regex: searchtext, $options: 'i' } },
        ];
    }
    return query;
}

async function listReviews(req, res, { publishedOnly = false } = {}) {
    try {
        const { filter, searchtext, sort, skip, limit } = parseListRequest(req.body || {});
        const query = buildQuery(filter, searchtext, { publishedOnly });
        const rows = await StorefrontReview.find(query).sort(sort).skip(skip).limit(limit).lean();
        const totalCount = await StorefrontReview.countDocuments(query);
        const aggregate = await StorefrontReview.aggregate([
            { $match: query },
            { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]);
        const averageRating = aggregate.length ? Number(aggregate[0].avg || 0) : 0;
        return res.status(200).json({
            success: true,
            totalCount,
            count: rows.length,
            averageRating: Math.round(averageRating * 10) / 10,
            data: rows,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
}

exports.getAllStorefrontReviews = async (req, res) => listReviews(req, res, { publishedOnly: false });

exports.getStorefrontReviewById = async (req, res) => {
    try {
        const row = await StorefrontReview.findById(req.params.id).lean();
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        return res.status(200).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

// Intentionally blocked: this master is system-managed from storefront submissions.
exports.createStorefrontReview = async (req, res) =>
    res.status(405).json({ success: false, message: 'Create is disabled. Reviews come from storefront users.' });

exports.updateStorefrontReview = async (req, res) =>
    res.status(405).json({ success: false, message: 'Update is disabled. Reviews are read-only in dashboard.' });

exports.deleteStorefrontReview = async (req, res) =>
    res.status(405).json({ success: false, message: 'Delete is disabled. Reviews are read-only in dashboard.' });

exports.postPublicProductReviews = async (req, res) => listReviews(req, res, { publishedOnly: true });

exports.submitPublicProductReview = async (req, res) => {
    try {
        const productId = String(req.body?.productId || '').trim();
        const productName = String(req.body?.productName || '').trim();
        const reviewerName = String(req.body?.reviewerName || '').trim();
        const title = String(req.body?.title || '').trim();
        const text = String(req.body?.text || '').trim();
        const rawRating = Number(req.body?.rating);
        const halfStepRating = Math.round(rawRating * 2) / 2;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'productId is required' });
        }
        if (!reviewerName) {
            return res.status(400).json({ success: false, message: 'reviewerName is required' });
        }
        if (!text) {
            return res.status(400).json({ success: false, message: 'Review text is required' });
        }
        if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }
        if (Math.abs(rawRating - halfStepRating) > 1e-9) {
            return res.status(400).json({ success: false, message: 'Rating must be in 0.5 steps (e.g. 3.5)' });
        }

        const row = await StorefrontReview.create({
            productId: productId.slice(0, 128),
            productName: productName.slice(0, 180),
            reviewerName: reviewerName.slice(0, 80),
            rating: halfStepRating,
            title: title.slice(0, 120),
            text: text.slice(0, 2000),
            source: 'orinket-web',
            status: 1,
            recordinfo: {
                createat: Date.now(),
                createby: 'customer',
            },
        });

        return res.status(201).json({ success: true, data: row });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};
