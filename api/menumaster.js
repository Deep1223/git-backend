const MenuMaster = require('../modal/menumaster');

// Get all modules (Listing with POST as requested)
exports.getAllModules = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { menuname: { $regex: searchtext, $options: 'i' } },
                { pagename: { $regex: searchtext, $options: 'i' } },
                { aliasname: { $regex: searchtext, $options: 'i' } },
                { icon: { $regex: searchtext, $options: 'i' } }
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
        
        // Handle projection
        const projection = paginationinfo?.projection || {};
        let modules = [];

        if (resolvedSortField === 'menuname' || resolvedSortField === 'module') {
            const moduleOrder = resolvedSortOrder === -1 ? -1 : 1;
            const moduleNumberGroupOrder = moduleOrder === 1 ? -1 : 1;
            
            // Build aggregation pipeline with projection
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __moduleSortKey: { $toLower: { $ifNull: ['$menuname', ''] } },
                        __moduleStartsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: ['$menuname', ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __moduleStartsWithNumber: moduleNumberGroupOrder,
                        __moduleSortKey: moduleOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            // Add projection stage if specified
            if (Object.keys(projection).length > 0) {
                pipeline.splice(pipeline.length - 2, 0, { $project: projection });
            } else {
                pipeline.push({ $unset: ['__moduleSortKey', '__moduleStartsWithNumber'] });
            }

            modules = await MenuMaster.aggregate(pipeline).collation(collation);
        } else {
            // Regular find with projection
            let query = MenuMaster.find(filter)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);

            // Apply projection if specified
            if (Object.keys(projection).length > 0) {
                query = query.select(projection);
            }

            modules = await query;
        }

        const totalCount = await MenuMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: modules.length,
            data: modules
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single module
exports.getModuleById = async (req, res) => {
    try {
        const module = await MenuMaster.findById(req.params.id);
        if (!module) {
            return res.status(404).json({
                success: false,
                message: 'Module not found'
            });
        }
        res.status(200).json({
            success: true,
            data: module
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new Module
exports.createModule = async (req, res) => {
    try {
        // Handle boolean field conversions from frontend strings
        if (req.body.showinsidebar !== undefined) {
            req.body.showinsidebar = req.body.showinsidebar === true || req.body.showinsidebar === 'true' || req.body.showinsidebar === 1 ? 1 : 0;
        }
        if (req.body.status !== undefined) {
            req.body.status = Number(req.body.status);
        }

        // Set recordinfo automatically for create only
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const module = await MenuMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: module
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Module already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update module
exports.updateModule = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let module = await MenuMaster.findById(id);

        if (!module) {
            return res.status(404).json({
                success: false,
                message: 'Module not found'
            });
        }

        // Handle boolean field conversions from frontend strings
        if (req.body.showinsidebar !== undefined) {
            req.body.showinsidebar = req.body.showinsidebar === true || req.body.showinsidebar === 'true' || req.body.showinsidebar === 1 ? 1 : 0;
        }
        if (req.body.status !== undefined) {
            req.body.status = Number(req.body.status);
        }

        // Update recordinfo.updateby
        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        module = await MenuMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: module
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete module
exports.deleteModule = async (req, res) => {
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
                        { menuname: { $regex: searchtext, $options: 'i' } },
                        { pagename: { $regex: searchtext, $options: 'i' } },
                        { aliasname: { $regex: searchtext, $options: 'i' } },
                        { icon: { $regex: searchtext, $options: 'i' } }
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

                await MenuMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await MenuMaster.deleteMany({ 
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected modules removed'
            });
        }

        // Handle legacy single string ID or array of IDs
        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await MenuMaster.deleteMany({ 
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Module removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
