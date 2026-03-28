const SeriesMaster = require('../modal/seriesmaster');
const MenuMaster = require('../modal/menumaster');

// Get all series
exports.getAllSeries = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { seriescode: { $regex: searchtext, $options: 'i' } },
                { separator: { $regex: searchtext, $options: 'i' } },
                { suffix: { $regex: searchtext, $options: 'i' } },
                { formatpreview: { $regex: searchtext, $options: 'i' } }
            ];
        }

        // Always include status filter for active records
        if (!filter.status) {
            filter.status = 1;
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
        let series = [];

        if (resolvedSortField === 'seriescode') {
            const seriescodeOrder = resolvedSortOrder === -1 ? -1 : 1;
            const seriescodeNumberGroupOrder = seriescodeOrder === 1 ? -1 : 1;
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __seriescodeSortKey: { $toLower: { $ifNull: ['$seriescode', ''] } },
                        __seriescodeStartsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: ['$seriescode', ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __seriescodeStartsWithNumber: seriescodeNumberGroupOrder,
                        __seriescodeSortKey: seriescodeOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['__seriescodeSortKey', '__seriescodeStartsWithNumber'] }
            ];
            if (hasProjection) pipeline.push({ $project: projection });
            series = await SeriesMaster.aggregate(pipeline).collation(collation);
        } else {
            series = await SeriesMaster.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const totalCount = await SeriesMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: series.length,
            data: series
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single series
exports.getSeriesById = async (req, res) => {
    try {
        const series = await SeriesMaster.findById(req.params.id)
            .populate('menunameid', 'menuname');
             
        if (!series) {
            return res.status(404).json({
                success: false,
                message: 'Series not found'
            });
        }
        res.status(200).json({
            success: true,
            data: series
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new series
exports.createSeries = async (req, res) => {
    try {
        // Get menu details
        const menu = await MenuMaster.findById(req.body.menunameid);
        
        if (!menu) {
            return res.status(400).json({
                success: false,
                message: 'Menu not found'
            });
        }

        // Add menuname to the request body
        req.body.menuname = menu.menuname;
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const series = await SeriesMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: series
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Series name or code already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update series
exports.updateSeries = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let series = await SeriesMaster.findById(id);

        if (!series) {
            return res.status(404).json({
                success: false,
                message: 'Series not found'
            });
        }

        // If menunameid is being updated, get the new name
        if (req.body.menunameid) {
            const menu = await MenuMaster.findById(req.body.menunameid);
            if (!menu) {
                return res.status(400).json({
                    success: false,
                    message: 'Menu not found'
                });
            }
            req.body.menuname = menu.menuname;
        }

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        series = await SeriesMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: series
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete series
exports.deleteSeries = async (req, res) => {
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
                        { seriescode: { $regex: searchtext, $options: 'i' } },
                        { separator: { $regex: searchtext, $options: 'i' } },
                        { suffix: { $regex: searchtext, $options: 'i' } },
                        { formatpreview: { $regex: searchtext, $options: 'i' } }
                    ];
                }

                const query = {
                    $and: [
                        { status: 1 },
                        {
                            $or: [
                                filter,
                                { _id: { $in: bulkactionids || [] } }
                            ]
                        }
                    ]
                };

                await SeriesMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await SeriesMaster.deleteMany({ 
                        _id: { $in: bulkactionids },
                        status: 1
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected series removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await SeriesMaster.deleteMany({ 
            _id: { $in: idsToDelete },
            status: 1
        });

        res.status(200).json({
            success: true,
            message: 'Series removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};
