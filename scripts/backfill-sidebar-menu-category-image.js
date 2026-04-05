/**
 * Ensures sidebarMenu.categories[].imageUrl exists for all category objects.
 *
 * Run:
 *   node scripts/backfill-sidebar-menu-category-image.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const SidebarMenu = require('../modal/sidebarMenu');

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    const docs = await SidebarMenu.find({});
    let docsUpdated = 0;
    let categoriesPatched = 0;

    for (const doc of docs) {
        let changed = false;
        doc.categories = (doc.categories || []).map((category) => {
            const raw = category.toObject ? category.toObject() : category;
            if (typeof raw.imageUrl !== 'string') {
                changed = true;
                categoriesPatched += 1;
                return { ...raw, imageUrl: '' };
            }
            return raw;
        });
        if (changed) {
            doc.updatedBy = 'script:backfill-sidebar-menu-category-image';
            await doc.save();
            docsUpdated += 1;
        }
    }

    console.log('Sidebar menu imageUrl backfill done');
    console.log({ totalDocs: docs.length, docsUpdated, categoriesPatched });

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
