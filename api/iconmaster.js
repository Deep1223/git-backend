const IconMaster = require('../modal/iconmaster');

// Get all icons (Listing with POST as requested)
exports.getAllIcons = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { icon: { $regex: searchtext, $options: 'i' } },
                { iconclass: { $regex: searchtext, $options: 'i' } }
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
        
        let icons = [];

        if (resolvedSortField === 'icon') {
            const iconOrder = resolvedSortOrder === -1 ? -1 : 1;
            const iconNumberGroupOrder = iconOrder === 1 ? -1 : 1;
            
            // Build aggregation pipeline with projection
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __iconSortKey: { $toLower: { $ifNull: ['$icon', ''] } },
                        __iconStartsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: ['$icon', ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __iconStartsWithNumber: iconNumberGroupOrder,
                        __iconSortKey: iconOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            // Add projection stage if specified
            if (Object.keys(projection).length > 0) {
                pipeline.push({ $project: projection });
            } else {
                pipeline.push({ $unset: ['__iconSortKey', '__iconStartsWithNumber'] });
            }

            icons = await IconMaster.aggregate(pipeline).collation(collation);
        } else {
            // Regular find with projection
            let query = IconMaster.find(filter)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);

            // Apply projection if specified
            if (Object.keys(projection).length > 0) {
                query = query.select(projection);
            }

            icons = await query;
        }

        const totalCount = await IconMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: icons.length,
            data: icons
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single icon
exports.getIconById = async (req, res) => {
    try {
        const icon = await IconMaster.findById(req.params.id);
        if (!icon) {
            return res.status(404).json({
                success: false,
                message: 'Icon not found'
            });
        }
        res.status(200).json({
            success: true,
            data: icon
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new Icon
exports.createIcon = async (req, res) => {
    try {
        // Set recordinfo automatically for create only
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const icon = await IconMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: icon
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Icon already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update icon
exports.updateIcon = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let icon = await IconMaster.findById(id);

        if (!icon) {
            return res.status(404).json({
                success: false,
                message: 'Icon not found'
            });
        }

        // Update recordinfo.updateby
        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        icon = await IconMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: icon
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete icon
exports.deleteIcon = async (req, res) => {
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
                        { icon: { $regex: searchtext, $options: 'i' } },
                        { iconclass: { $regex: searchtext, $options: 'i' } }
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

                await IconMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await IconMaster.deleteMany({ 
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected icons removed'
            });
        }

        // Handle legacy single string ID or array of IDs
        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await IconMaster.deleteMany({ 
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Icon removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
