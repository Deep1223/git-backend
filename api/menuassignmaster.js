const MenuAssignMaster = require('../modal/menuassignmaster');

// Get all menu assignments (Listing with POST)
exports.getAllMenuAssignments = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};
        const hasProjection = Object.keys(projection).length > 0;

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { module: { $regex: searchtext, $options: 'i' } },
                { menu: { $regex: searchtext, $options: 'i' } }
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
        let assignments = [];

        if (resolvedSortField === 'module' || resolvedSortField === 'menu') {
            const sortField = resolvedSortField; // 'module' or 'menu'
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

            assignments = await MenuAssignMaster.aggregate(pipeline).collation(collation);
        } else {
            let query = MenuAssignMaster.find(filter)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);

            if (hasProjection) {
                query = query.select(projection);
            }

            assignments = await query;
        }

        const totalCount = await MenuAssignMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: assignments.length,
            data: assignments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single menu assignment
exports.getMenuAssignmentById = async (req, res) => {
    try {
        const assignment = await MenuAssignMaster.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Menu assignment not found'
            });
        }
        res.status(200).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new menu assignment
exports.createMenuAssignment = async (req, res) => {
    try {
        if (req.body.status !== undefined) {
            req.body.status = Number(req.body.status);
        }

        // Set recordinfo automatically for create only
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const assignment = await MenuAssignMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This menu is already assigned. Each menu can only be assigned once.'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update menu assignment
exports.updateMenuAssignment = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let assignment = await MenuAssignMaster.findById(id);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Menu assignment not found'
            });
        }

        if (req.body.status !== undefined) {
            req.body.status = Number(req.body.status);
        }

        // Update recordinfo
        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        assignment = await MenuAssignMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete menu assignment
exports.deleteMenuAssignment = async (req, res) => {
    try {
        const idData = req.body._id || req.params.id;

        if (!idData) {
            return res.status(400).json({ success: false, message: 'No delete data provided' });
        }

        // Handle complex bulk delete object
        if (typeof idData === 'object' && !Array.isArray(idData)) {
            const { bulkactionids, selectall, paginationinfo, searchtext } = idData;

            let filter = paginationinfo?.filter || {};
            if (selectall) {
                if (searchtext) {
                    filter.$or = [
                        { module: { $regex: searchtext, $options: 'i' } },
                        { menu: { $regex: searchtext, $options: 'i' } }
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

                await MenuAssignMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await MenuAssignMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected menu assignments removed'
            });
        }

        // Handle legacy single string ID or array of IDs
        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await MenuAssignMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Menu assignment removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};