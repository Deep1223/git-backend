const User = require('../modal/user');
const SeriesMaster = require('../modal/seriesmaster');

// Generate user with automatic series assignment
exports.generateUsercode = async (req, res) => {
    try {
        // Get first available series master
        const seriesMaster = await SeriesMaster.findOne({ status: 1 });
        
        if (!seriesMaster) {
            // Fallback to simple sequential usercode if no series found
            const lastUser = await User.findOne().sort({ _id: -1 });
            let nextNumber = 1;
            
            if (lastUser && lastUser.usercode) {
                const match = lastUser.usercode.match(/USER(\d+)/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }
            
            const usercode = `USER${nextNumber.toString().padStart(4, '0')}`;
            
            return res.status(200).json({
                success: true,
                usercode: usercode,
                method: 'fallback'
            });
        }

        // Generate usercode using current number + 1 (without updating series master)
        const nextNumber = seriesMaster.currentnumber + 1;
        const paddedNumber = nextNumber.toString().padStart(seriesMaster.numberlength, '0');
        const usercode = `${seriesMaster.seriescode}${seriesMaster.separator}${paddedNumber}${seriesMaster.suffix}`;

        // Return response with just the usercode (don't update series master yet)
        res.status(200).json({
            success: true,
            usercode: usercode,
            method: 'series'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
