const CityMaster = require('../modal/citymaster');

// Get all cities
exports.getAllCities = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { cityname: { $regex: searchtext, $options: 'i' } },
                { state: { $regex: searchtext, $options: 'i' } },
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
        let cities = [];

        if (resolvedSortField === 'cityname' || resolvedSortField === 'state' || resolvedSortField === 'country') {
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
            cities = await CityMaster.aggregate(pipeline).collation(collation);
        } else {
            cities = await CityMaster.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const totalCount = await CityMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: cities.length,
            data: cities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single city
exports.getCityById = async (req, res) => {
    try {
        const city = await CityMaster.findById(req.params.id);
        if (!city) {
            return res.status(404).json({
                success: false,
                message: 'City not found'
            });
        }
        res.status(200).json({
            success: true,
            data: city
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new city
exports.createCity = async (req, res) => {
    try {
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const city = await CityMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: city
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'City name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update city
exports.updateCity = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let city = await CityMaster.findById(id);

        if (!city) {
            return res.status(404).json({
                success: false,
                message: 'City not found'
            });
        }

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        city = await CityMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: city
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete city
exports.deleteCity = async (req, res) => {
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
                        { cityname: { $regex: searchtext, $options: 'i' } },
                        { state: { $regex: searchtext, $options: 'i' } },
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

                await CityMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await CityMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected cities removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await CityMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'City removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};