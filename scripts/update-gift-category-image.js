/**
 * Updates Gifts category image to a stable URL.
 *
 * Run:
 *   node scripts/update-gift-category-image.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CategoryMaster = require('../modal/categorymaster');

const GIFT_IMAGE_URL =
    'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=1200&auto=format&fit=crop';

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    const before = await CategoryMaster.find({ categoryname: /gift/i })
        .select('_id categoryname categoryimage')
        .lean();
    console.log('Before:', before);

    const res = await CategoryMaster.updateMany(
        { categoryname: /gift/i },
        {
            $set: {
                categoryimage: GIFT_IMAGE_URL,
                'recordinfo.updateby': 'script:update-gift-category-image',
                'recordinfo.updateat': Date.now(),
            },
        }
    );

    const after = await CategoryMaster.find({ categoryname: /gift/i })
        .select('_id categoryname categoryimage')
        .lean();
    console.log('Updated:', { matched: res.matchedCount, modified: res.modifiedCount });
    console.log('After:', after);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
