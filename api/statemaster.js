const StateMaster = require('../modal/statemaster');

// Get all states
exports.getAllStates = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { statename: { $regex: searchtext, $options: 'i' } },
                { country: { $regex: searchtext, $options: 'i' } }
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
        let states = [];

        if (resolvedSortField === 'statename' || resolvedSortField === 'country') {
            const sortOrder = resolvedSortOrder === -1 ? -1 : 1;
            const numberGroupOrder = sortOrder === 1 ? -1 : 1;
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __sortKey: { $toLower: { $ifNull: [`$${resolvedSortField}`, ''] } },
                        __startsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: [`$${resolvedSortField}`, ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __startsWithNumber: numberGroupOrder,
                        __sortKey: sortOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['__sortKey', '__startsWithNumber'] }
            ];
            if (hasProjection) pipeline.push({ $project: projection });
            states = await StateMaster.aggregate(pipeline).collation(collation);
        } else {
            states = await StateMaster.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const totalCount = await StateMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: states.length,
            data: states
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single state
exports.getStateById = async (req, res) => {
    try {
        const state = await StateMaster.findById(req.params.id);
        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State not found'
            });
        }
        res.status(200).json({
            success: true,
            data: state
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new state
exports.createState = async (req, res) => {
    try {
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const state = await StateMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: state
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'State name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update state
exports.updateState = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let state = await StateMaster.findById(id);

        if (!state) {
            return res.status(404).json({
                success: false,
                message: 'State not found'
            });
        }

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        state = await StateMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: state
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete state
exports.deleteState = async (req, res) => {
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
                        { statename: { $regex: searchtext, $options: 'i' } },
                        { country: { $regex: searchtext, $options: 'i' } }
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

                await StateMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await StateMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected states removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await StateMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'State removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};