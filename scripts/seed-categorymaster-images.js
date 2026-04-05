/**
 * Fill Category Master `categoryimage` for all categories.
 *
 * Run:
 *   node scripts/seed-categorymaster-images.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CategoryMaster = require('../modal/categorymaster');

const IMAGE_POOL = [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1627293509201-1b02c9862a7f?w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?w=1200&auto=format&fit=crop',
];

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    await mongoose.connect(uri);

    const rows = await CategoryMaster.find({})
        .sort({ 'recordinfo.createat': 1, categoryname: 1 })
        .select('_id categoryname')
        .lean();

    if (!rows.length) {
        console.log('No categories found.');
        await mongoose.disconnect();
        return;
    }

    const now = Date.now();
    const bulkOps = rows.map((row, idx) => ({
        updateOne: {
            filter: { _id: row._id },
            update: {
                $set: {
                    categoryimage: IMAGE_POOL[idx % IMAGE_POOL.length],
                    'recordinfo.updateby': 'script:seed-categorymaster-images',
                    'recordinfo.updateat': now,
                },
            },
        },
    }));

    const res = await CategoryMaster.bulkWrite(bulkOps, { ordered: false });
    console.log(`Updated category images on ${res.modifiedCount || 0} category(s).`);
    rows.forEach((r, i) => {
        console.log(`- ${r.categoryname} -> ${IMAGE_POOL[i % IMAGE_POOL.length]}`);
    });

    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error(e);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});
