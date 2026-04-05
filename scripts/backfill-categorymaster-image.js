/**
 * Ensures CategoryMaster.categoryimage exists for all category docs.
 *
 * Run:
 *   node scripts/backfill-categorymaster-image.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CategoryMaster = require('../modal/categorymaster');

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    const docs = await CategoryMaster.find({});
    let updated = 0;

    for (const doc of docs) {
        if (typeof doc.categoryimage !== 'string') {
            doc.categoryimage = '';
            if (!doc.recordinfo || typeof doc.recordinfo !== 'object') {
                doc.recordinfo = {};
            }
            doc.recordinfo.updateby = 'script:backfill-categorymaster-image';
            doc.recordinfo.updateat = Date.now();
            await doc.save();
            updated += 1;
        }
    }

    console.log('Category image backfill done');
    console.log({ totalRows: docs.length, updated });

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
