/**
 * Seed Occasion Master and auto-assign occasions to all Product Master rows.
 *
 * Run:
 *   cd backend
 *   node scripts/seed-occasions-and-assign-products.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { slugifyLabel } = require('../lib/slugifyLabel');
const OccasionMaster = require('../modal/occasionmaster');
const ProductMaster = require('../modal/productmaster');

const OCCASION_SEED = [
    { name: 'Office Wear', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&auto=format&fit=crop' },
    { name: 'Daily Wear', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&auto=format&fit=crop' },
    { name: 'Wedding Wear', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=900&auto=format&fit=crop' },
    { name: 'Party Wear', image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=900&auto=format&fit=crop' },
    { name: 'Night Wear', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&auto=format&fit=crop' },
    { name: 'Festive Wear', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&auto=format&fit=crop' },
    { name: 'Travel Wear', image: 'https://images.unsplash.com/photo-1521335629791-ce4aec67dd47?w=900&auto=format&fit=crop' },
    { name: 'Date Night', image: 'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=900&auto=format&fit=crop' },
];

function buildAssignments(products, occasions) {
    const total = occasions.length;
    return products.map((p, i) => {
        const a = occasions[i % total];
        const b = occasions[(i + 3) % total];
        const ids = [String(a._id), String(b._id)];
        const labels = [a.occasionname, b.occasionname];
        return {
            _id: p._id,
            occasionids: [...new Set(ids)].map((id) => new mongoose.Types.ObjectId(id)),
            occasions: [...new Set(labels.map((x) => String(x).trim()).filter(Boolean))],
        };
    });
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    await mongoose.connect(uri);

    let upserts = 0;
    for (let i = 0; i < OCCASION_SEED.length; i += 1) {
        const row = OCCASION_SEED[i];
        const name = String(row.name).trim();
        if (!name) continue;
        const update = {
            $set: {
                status: 1,
                sortorder: i + 1,
                image: row.image || '',
                description: `${name} collection`,
            },
            $setOnInsert: {
                occasionname: name,
                slug: slugifyLabel(name),
                recordinfo: { createby: 'script' },
            },
        };
        const res = await OccasionMaster.updateOne({ occasionname: name }, update, { upsert: true });
        if (res.upsertedCount > 0) upserts += 1;
    }

    const occasions = await OccasionMaster.find({ status: 1 })
        .sort({ sortorder: 1, occasionname: 1 })
        .select('_id occasionname')
        .lean();
    if (!occasions.length) {
        throw new Error('No active occasions found after seed.');
    }

    const products = await ProductMaster.find({})
        .select('_id productname')
        .sort({ _id: 1 })
        .lean();
    if (!products.length) {
        console.log(`Occasions ready (${occasions.length}) but no products found.`);
        await mongoose.disconnect();
        return;
    }

    const assignments = buildAssignments(products, occasions);
    const bulkOps = assignments.map((a) => ({
        updateOne: {
            filter: { _id: a._id },
            update: {
                $set: {
                    occasionids: a.occasionids,
                    occasions: a.occasions,
                },
            },
        },
    }));

    const bulkRes = await ProductMaster.bulkWrite(bulkOps, { ordered: false });

    console.log(`Occasion seed done. inserted=${upserts}, totalActive=${occasions.length}`);
    console.log(
        `Product assignment done. matched=${bulkRes.matchedCount || 0}, modified=${bulkRes.modifiedCount || 0}, totalProducts=${products.length}`
    );
    console.log('Assigned occasions:', occasions.map((o) => o.occasionname).join(', '));

    await mongoose.disconnect();
}

main().catch(async (e) => {
    console.error(e);
    try {
        await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
});

