const OccasionMaster = require('../modal/occasionmaster');
const { slugifyLabel } = require('../lib/slugifyLabel');

exports.getAllOccasions = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};

        if (searchtext) {
            filter.$or = [
                { occasionname: { $regex: searchtext, $options: 'i' } },
                { description: { $regex: searchtext, $options: 'i' } },
                { slug: { $regex: searchtext, $options: 'i' } },
            ];
        }

        const incomingSort = paginationinfo?.sort || {};
        let resolvedSortField = 'sortorder';
        let resolvedSortOrder = 1;

        if (incomingSort?.field) {
            const fieldFromRequest =
                incomingSort.field === 'createdAt'
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
                const mappedField =
                    rawField === 'createdAt'
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

        let occasions = await OccasionMaster.find(filter, hasProjection ? projection : undefined)
            .collation(collation)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const totalCount = await OccasionMaster.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: occasions.length,
            data: occasions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.getOccasionById = async (req, res) => {
    try {
        const doc = await OccasionMaster.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Occasion not found' });
        }
        res.status(200).json({ success: true, data: doc });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

exports.createOccasion = async (req, res) => {
    try {
        const body = { ...req.body };
        if (body.slug !== undefined && body.slug !== null) {
            body.slug = slugifyLabel(body.slug);
        }
        body.recordinfo = {
            createby: req.user ? req.user.username : 'system',
        };
        const doc = await OccasionMaster.create(body);
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Occasion name or slug already exists',
            });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateOccasion = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let doc = await OccasionMaster.findById(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Occasion not found' });
        }
        if (req.body.slug !== undefined && req.body.slug !== null) {
            req.body.slug = slugifyLabel(req.body.slug);
        }
        if (!req.body.recordinfo) req.body.recordinfo = {};
        req.body.recordinfo.updateby = req.user ? req.user.username : 'system';
        req.body.recordinfo.updateat = Date.now();

        doc = await OccasionMaster.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true,
        });
        res.status(200).json({ success: true, data: doc });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Occasion name or slug already exists',
            });
        }
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteOccasion = async (req, res) => {
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
                        { occasionname: { $regex: searchtext, $options: 'i' } },
                        { description: { $regex: searchtext, $options: 'i' } },
                    ];
                }
                const query = {
                    $or: [filter, { _id: { $in: bulkactionids || [] } }],
                };
                await OccasionMaster.deleteMany(query);
            } else if (bulkactionids && bulkactionids.length > 0) {
                await OccasionMaster.deleteMany({ _id: { $in: bulkactionids } });
            } else {
                return res.status(400).json({ success: false, message: 'No records selected to delete' });
            }
            return res.status(200).json({ success: true, message: 'Selected occasions removed' });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await OccasionMaster.deleteMany({ _id: { $in: idsToDelete } });
        res.status(200).json({ success: true, message: 'Occasion removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};
