const CategoryMaster = require('../modal/categorymaster');

// Get all categories (pagination, sort, filter, search, projection)
exports.getAllCategories = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        if (searchtext) {
            filter.$or = [
                { categoryname: { $regex: searchtext, $options: 'i' } },
                { description: { $regex: searchtext, $options: 'i' } }
            ];
        }

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

        const sort = { [resolvedSortField]: resolvedSortOrder };
        const page = paginationinfo?.pageno || 1;
        const limit = paginationinfo?.pagelimit || 20;
        const skip = (page - 1) * limit;
        const collation = { locale: 'en', numericOrdering: true, strength: 2 };
        const hasProjection = Object.keys(projection).length > 0;
        let categories = [];

        if (resolvedSortField === 'categoryname') {
            const nameOrder = resolvedSortOrder === -1 ? -1 : 1;
            const nameNumberGroupOrder = nameOrder === 1 ? -1 : 1;
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __categorynameSortKey: { $toLower: { $ifNull: ['$categoryname', ''] } },
                        __categorynameStartsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: ['$categoryname', ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __categorynameStartsWithNumber: nameNumberGroupOrder,
                        __categorynameSortKey: nameOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['__categorynameSortKey', '__categorynameStartsWithNumber'] }
            ];
            if (hasProjection) pipeline.push({ $project: projection });
            categories = await CategoryMaster.aggregate(pipeline).collation(collation);
        } else {
            categories = await CategoryMaster.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const totalCount = await CategoryMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single category
exports.getCategoryById = async (req, res) => {
    try {
        const category = await CategoryMaster.findById(req.params.id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new category
exports.createCategory = async (req, res) => {
    try {
        // Set recordinfo automatically for create only
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const category = await CategoryMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: category
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let category = await CategoryMaster.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Update recordinfo.updateby
        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        category = await CategoryMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const idData = req.body._id || req.params.id;

        if (!idData) {
            return res.status(400).json({ success: false, message: 'No delete data provided' });
        }

        // If it's the new complex object
        if (typeof idData === 'object' && !Array.isArray(idData)) {
            const { bulkactionids, selectall, paginationinfo, searchtext } = idData;

            let filter = paginationinfo?.filter || {};
            if (selectall) {
                if (searchtext) {
                    filter.$or = [
                        { categoryname: { $regex: searchtext, $options: 'i' } },
                        { description: { $regex: searchtext, $options: 'i' } }
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

                await CategoryMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await CategoryMaster.deleteMany({ 
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected categories removed'
            });
        }

        // Handle legacy single string ID or array of IDs
        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await CategoryMaster.deleteMany({ 
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Category removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
