const ProductMaster = require('../modal/productmaster');
const { getPreviewNextProductSeriesCode } = require('../lib/productSeriesAllocator');

const STRING_SORT_DB_FIELDS = [
    'productname',
    'productseries',
    'category',
    'subcategory',
    'description',
    'material',
    'plating',
    'dimensions',
    'weight',
];

function normalizeProductBody(body) {
    const b = body && typeof body === 'object' ? { ...body } : {};
    if (b.price !== undefined && b.price !== '' && b.price !== null) b.price = Number(b.price);
    if (b.originalPrice !== undefined && b.originalPrice !== '' && b.originalPrice !== null) {
        b.originalPrice = Number(b.originalPrice);
    }
    if (b.status !== undefined && b.status !== null && b.status !== '') b.status = Number(b.status);
    if (b.availableQty !== undefined && b.availableQty !== null && b.availableQty !== '') {
        const q = Math.floor(Number(b.availableQty));
        b.availableQty = Number.isFinite(q) ? Math.max(0, q) : 0;
        b.instock = b.availableQty > 0 ? 1 : 0;
    } else if (b.instock !== undefined && b.instock !== null && b.instock !== '') {
        b.instock = Number(b.instock) > 0 ? 1 : 0;
        if (b.availableQty === undefined) {
            b.availableQty = b.instock ? 1 : 0;
        }
    }

    if (b.images !== undefined) {
        b.images = Array.isArray(b.images) ? b.images.filter((u) => u != null && String(u).trim() !== '') : [];
    }

    if (b.productdetails !== undefined) {
        b.productdetails = Array.isArray(b.productdetails)
            ? b.productdetails.map((row) => ({
                  details: row && row.details != null ? String(row.details) : '',
              }))
            : [];
    }

    return b;
}

function resolveSort(paginationinfo) {
    const incomingSort = paginationinfo?.sort || {};
    let resolvedSortField = 'recordinfo.createat';
    let resolvedSortOrder = -1;

    if (incomingSort?.field) {
        const fieldFromRequest = incomingSort.field === 'createdAt'
            ? 'recordinfo.createat'
            : incomingSort.field === 'updatedAt'
                ? 'recordinfo.updateat'
                : incomingSort.field;
        const orderFromRequest = Number(incomingSort.order);

        if (fieldFromRequest && (orderFromRequest === 1 || orderFromRequest === -1)) {
            resolvedSortField = fieldFromRequest;
            resolvedSortOrder = orderFromRequest;
        }
    } else {
        const sortEntries = Object.entries(incomingSort);
        if (sortEntries.length > 0) {
            const [rawField, rawOrder] = sortEntries[0];
            const mappedField = rawField === 'createdAt'
                ? 'recordinfo.createat'
                : rawField === 'updatedAt'
                    ? 'recordinfo.updateat'
                    : rawField;
            const mappedOrder = Number(rawOrder);

            if (mappedField && (mappedOrder === 1 || mappedOrder === -1)) {
                resolvedSortField = mappedField;
                resolvedSortOrder = mappedOrder;
            }
        }
    }

    return {
        resolvedSortField,
        resolvedSortOrder,
        sort: { [resolvedSortField]: resolvedSortOrder }
    };
}

// Get all products (listing POST — pagination, sort, filter, search, projection)
exports.getAllProducts = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};
        const hasProjection = Object.keys(projection).length > 0;

        if (searchtext) {
            filter.$or = [
                { productname: { $regex: searchtext, $options: 'i' } },
                { productseries: { $regex: searchtext, $options: 'i' } },
                { category: { $regex: searchtext, $options: 'i' } },
                { subcategory: { $regex: searchtext, $options: 'i' } },
                { description: { $regex: searchtext, $options: 'i' } },
                { material: { $regex: searchtext, $options: 'i' } },
            ];
        }

        const { resolvedSortField, resolvedSortOrder, sort } = resolveSort(paginationinfo);
        const page = paginationinfo?.pageno || 1;
        const limit = paginationinfo?.pagelimit || 20;
        const skip = (page - 1) * limit;
        const collation = { locale: 'en', numericOrdering: true, strength: 2 };
        let products = [];

        const sortField =
            resolvedSortField === 'categoryid'
                ? 'category'
                : resolvedSortField === 'subcategoryid'
                  ? 'subcategory'
                  : resolvedSortField;
        const useStringSort =
            resolvedSortField === 'categoryid' ||
            resolvedSortField === 'subcategoryid' ||
            STRING_SORT_DB_FIELDS.includes(sortField);

        if (useStringSort) {
            const fieldOrder = resolvedSortOrder === -1 ? -1 : 1;
            const numberGroupOrder = fieldOrder === 1 ? -1 : 1;

            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __sortKey: { $toLower: { $ifNull: [`$${sortField}`, ''] } },
                        __startsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: [`$${sortField}`, ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __startsWithNumber: numberGroupOrder,
                        __sortKey: fieldOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            if (hasProjection) {
                pipeline.splice(pipeline.length - 2, 0, { $project: projection });
            } else {
                pipeline.push({ $unset: ['__sortKey', '__startsWithNumber'] });
            }

            products = await ProductMaster.aggregate(pipeline).collation(collation);
        } else {
            let query = ProductMaster.find(filter)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);

            if (hasProjection) {
                query = query.select(projection);
            }

            products = await query;
        }

        const totalCount = await ProductMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

/** Next series code for UI (does not reserve / increment). */
exports.previewNextProductSeries = async (req, res) => {
    try {
        const code = await getPreviewNextProductSeriesCode();
        if (!code) {
            return res.status(404).json({
                success: false,
                message:
                    'No Series Master for Product Master. Add one in Series Master with Menu = Product Master.',
            });
        }
        res.status(200).json({
            success: true,
            data: { productseries: code },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await ProductMaster.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

exports.createProduct = async (req, res) => {
    try {
        delete req.body.productseries;
        Object.assign(req.body, normalizeProductBody(req.body));

        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const product = await ProductMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: product
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Product name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let product = await ProductMaster.findById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        delete req.body.productseries;
        Object.assign(req.body, normalizeProductBody(req.body));

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        product = await ProductMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: product
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Product name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const idData = req.body._id || req.params.id;

        if (!idData) {
            return res.status(400).json({ success: false, message: 'No delete data provided' });
        }

        if (typeof idData === 'object' && !Array.isArray(idData)) {
            const { bulkactionids, selectall, paginationinfo, searchtext } = idData;

            let filter = paginationinfo?.filter || {};
            if (selectall) {
                if (searchtext) {
                    filter.$or = [
                        { productname: { $regex: searchtext, $options: 'i' } },
                        { productseries: { $regex: searchtext, $options: 'i' } },
                        { category: { $regex: searchtext, $options: 'i' } }
                    ];
                }

                const query = {
                    $and: [
                        { defaultdata: { $ne: true } },
                        {
                            $or: [
                                filter,
                                { _id: { $in: bulkactionids || [] } }
                            ]
                        }
                    ]
                };

                await ProductMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await ProductMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected products removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await ProductMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Product removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
