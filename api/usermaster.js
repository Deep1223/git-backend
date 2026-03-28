const User = require('../modal/user');
const { moveToPermanent, deleteFromS3 } = require('../utils/s3');

// Get all users
exports.getAllUsers = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body;
        let filter = paginationinfo?.filter || {};

        // Handle Search Filter
        if (searchtext) {
            filter.$or = [
                { usercode: { $regex: searchtext, $options: 'i' } },
                { username: { $regex: searchtext, $options: 'i' } },
                { email: { $regex: searchtext, $options: 'i' } },
                { firstname: { $regex: searchtext, $options: 'i' } },
                { lastname: { $regex: searchtext, $options: 'i' } }
            ];
        }

        const incomingSort = paginationinfo?.sort || {};
        let resolvedSortField = 'recordinfo.createat';
        let resolvedSortOrder = -1;

        const mapSortField = (rawField) => {
            if (rawField === 'createdAt') return 'recordinfo.createat';
            if (rawField === 'updatedAt') return 'recordinfo.updateat';
            return rawField;
        };

        if (incomingSort?.field) {
            const fieldFromRequest = mapSortField(incomingSort.field);
            const orderFromRequest = Number(incomingSort.order);

            if (fieldFromRequest && (orderFromRequest === 1 || orderFromRequest === -1)) {
                resolvedSortField = fieldFromRequest;
                resolvedSortOrder = orderFromRequest;
            }
        } else {
            const sortEntries = Object.entries(incomingSort);
            if (sortEntries.length > 0) {
                const [rawField, rawOrder] = sortEntries[0];
                const mappedField = mapSortField(rawField);
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

        const users = await User.find(filter)
            .populate('cityid', 'city')
            .populate('stateid', 'state')
            .populate('countryid', 'country')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);

        const totalCount = await User.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Get single user
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('cityid', 'city')
            .populate('stateid', 'state')
            .populate('countryid', 'country');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// Create new user
exports.createUser = async (req, res) => {
    try {
        // Set recordinfo automatically for create only
        req.body.recordinfo = {
            createby: req.user ? req.user.username : 'system'
        };

        // Move image from temp to permanent if exists
        if (req.body.profileimage) {
            req.body.profileimage = await moveToPermanent(req.body.profileimage, 'users/profile');
        }

        // Generate usercode if not provided
        if (!req.body.usercode) {
            const SeriesMaster = require('../modal/seriesmaster');
            
            // Get first available series master
            const seriesMaster = await SeriesMaster.findOne({
                status: 1
            });
            
            if (seriesMaster) {
                // Generate usercode using current number + 1
                const nextNumber = seriesMaster.currentnumber + 1;
                const paddedNumber = nextNumber.toString().padStart(seriesMaster.numberlength, '0');
                const usercode = `${seriesMaster.seriescode}${seriesMaster.separator}${paddedNumber}${seriesMaster.suffix}`;
                
                // Update the current number in series master
                await SeriesMaster.findByIdAndUpdate(seriesMaster._id, {
                    currentnumber: nextNumber
                });
                
                req.body.usercode = usercode;
            }
        }

        const user = await User.create(req.body);
        
        // Populate the response with related data
        const populatedUser = await User.findById(user._id)
            .populate('cityid', 'city')
            .populate('stateid', 'state')
            .populate('countryid', 'country');
            
        res.status(201).json({
            success: true,
            data: populatedUser
        });
    } catch (error) {
        if (error.code === 11000) {
            let field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Handle image update
        if (req.body.profileimage && req.body.profileimage !== user.profileimage) {
            // Delete old image if exists
            if (user.profileimage) {
                await deleteFromS3(user.profileimage);
            }
            // Move new image to permanent
            req.body.profileimage = await moveToPermanent(req.body.profileimage, 'users/profile');
        }

        // Set recordinfo for update
        req.body.recordinfo = {
            ...user.recordinfo,
            updateby: req.user ? req.user.username : 'system',
            updateat: Date.now()
        };

        const updatedUser = await User.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true
        }).populate('cityid', 'city')
         .populate('stateid', 'state')
         .populate('countryid', 'country');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        if (error.code === 11000) {
            let field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const idData = req.body._id || req.params.id;

        if (!idData) {
            return res.status(400).json({ success: false, message: 'No delete data provided' });
        }

        let query = {};
        
        // If it's the new complex object
        if (typeof idData === 'object' && !Array.isArray(idData)) {
            const { bulkactionids, selectall, paginationinfo, searchtext } = idData;

            let filter = paginationinfo?.filter || {};
            if (selectall) {
                if (searchtext) {
                    filter.$or = [
                        { usercode: { $regex: searchtext, $options: 'i' } },
                        { username: { $regex: searchtext, $options: 'i' } },
                        { email: { $regex: searchtext, $options: 'i' } },
                        { firstname: { $regex: searchtext, $options: 'i' } },
                        { lastname: { $regex: searchtext, $options: 'i' } }
                    ];
                }

                query = {
                    $and: [
                        filter,
                        {
                            $or: [
                                filter,
                                { _id: { $in: bulkactionids || [] } }
                            ]
                        }
                    ]
                };
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    query = { 
                        _id: { $in: bulkactionids }
                    };
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }
        } else {
            // Handle legacy single string ID or array of IDs
            const idsToDelete = Array.isArray(idData) ? idData : [idData];
            query = { 
                _id: { $in: idsToDelete }
            };
        }

        // Cleanup profile images before deletion
        const usersToDelete = await User.find(query);
        for (const user of usersToDelete) {
            if (user.profileimage) {
                try {
                    await deleteFromS3(user.profileimage);
                } catch (s3Error) {
                    console.error(`Failed to delete profile image for user ${user._id}:`, s3Error);
                }
            }
        }

        await User.deleteMany(query);

        res.status(200).json({
            success: true,
            message: 'Users deleted'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
