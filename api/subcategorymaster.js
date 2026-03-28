const SubCategoryMaster = require('../modal/subcategorymaster');

const STRING_SORT_DB_FIELDS = ['subcategoryname', 'category'];

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

// Get all sub categories (listing POST — pagination, sort, filter, search, projection)
exports.getAllSubCategories = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};
        const hasProjection = Object.keys(projection).length > 0;

        if (searchtext) {
            filter.$or = [
                { subcategoryname: { $regex: searchtext, $options: 'i' } },
                { category: { $regex: searchtext, $options: 'i' } }
            ];
        }

        const { resolvedSortField, resolvedSortOrder, sort } = resolveSort(paginationinfo);
        const page = paginationinfo?.pageno || 1;
        const limit = paginationinfo?.pagelimit || 20;
        const skip = (page - 1) * limit;
        const collation = { locale: 'en', numericOrdering: true, strength: 2 };
        let rows = [];

        const sortField =
            resolvedSortField === 'categoryid' ? 'category' : resolvedSortField;
        const useStringSort =
            resolvedSortField === 'categoryid' ||
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

            rows = await SubCategoryMaster.aggregate(pipeline).collation(collation);
        } else {
            let query = SubCategoryMaster.find(filter)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);

            if (hasProjection) {
                query = query.select(projection);
            }

            rows = await query;
        }

        const totalCount = await SubCategoryMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

exports.getSubCategoryById = async (req, res) => {
    try {
        const doc = await SubCategoryMaster.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({
                success: false,
                message: 'Sub category not found'
            });
        }
        res.status(200).json({
            success: true,
            data: doc
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

exports.createSubCategory = async (req, res) => {
    try {
        if (req.body.status !== undefined) req.body.status = Number(req.body.status);

        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const doc = await SubCategoryMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: doc
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This sub category already exists for the selected category'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateSubCategory = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let doc = await SubCategoryMaster.findById(id);

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: 'Sub category not found'
            });
        }

        if (req.body.status !== undefined) req.body.status = Number(req.body.status);

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        doc = await SubCategoryMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: doc
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This sub category already exists for the selected category'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteSubCategory = async (req, res) => {
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
                        { subcategoryname: { $regex: searchtext, $options: 'i' } },
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

                await SubCategoryMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await SubCategoryMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected sub categories removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await SubCategoryMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Sub category removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
