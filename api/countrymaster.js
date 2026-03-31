const CountryMaster = require('../modal/countrymaster');

// Get all countries
exports.getAllCountries = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { countryname: { $regex: searchtext, $options: 'i' } },
                { countrycode: { $regex: searchtext, $options: 'i' } },
                { currencycode: { $regex: searchtext, $options: 'i' } },
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
        let countries = [];

        if (resolvedSortField === 'countryname') {
            const countrynameOrder = resolvedSortOrder === -1 ? -1 : 1;
            const countrynameNumberGroupOrder = countrynameOrder === 1 ? -1 : 1;
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __countrynameSortKey: { $toLower: { $ifNull: ['$countryname', ''] } },
                        __countrynameStartsWithNumber: {
                            $regexMatch: {
                                input: { $ifNull: ['$countryname', ''] },
                                regex: /^[0-9]/
                            }
                        }
                    }
                },
                {
                    $sort: {
                        __countrynameStartsWithNumber: countrynameNumberGroupOrder,
                        __countrynameSortKey: countrynameOrder,
                        _id: 1
                    }
                },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['__countrynameSortKey', '__countrynameStartsWithNumber'] }
            ];
            if (hasProjection) pipeline.push({ $project: projection });
            countries = await CountryMaster.aggregate(pipeline).collation(collation);
        } else {
            countries = await CountryMaster.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const totalCount = await CountryMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: countries.length,
            data: countries
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single country
exports.getCountryById = async (req, res) => {
    try {
        const country = await CountryMaster.findById(req.params.id);
        if (!country) {
            return res.status(404).json({
                success: false,
                message: 'Country not found'
            });
        }
        res.status(200).json({
            success: true,
            data: country
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new country
exports.createCountry = async (req, res) => {
    try {
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        const country = await CountryMaster.create(req.body);
        res.status(201).json({
            success: true,
            data: country
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Country name already exists'
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update country
exports.updateCountry = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let country = await CountryMaster.findById(id);

        if (!country) {
            return res.status(404).json({
                success: false,
                message: 'Country not found'
            });
        }

        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        country = await CountryMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: country
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete country
exports.deleteCountry = async (req, res) => {
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
                        { countryname: { $regex: searchtext, $options: 'i' } }
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

                await CountryMaster.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await CountryMaster.deleteMany({
                        _id: { $in: bulkactionids },
                        defaultdata: { $ne: true }
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected countries removed'
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await CountryMaster.deleteMany({
            _id: { $in: idsToDelete },
            defaultdata: { $ne: true }
        });

        res.status(200).json({
            success: true,
            message: 'Country removed'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};