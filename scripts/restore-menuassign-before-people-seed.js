/**
 * MenuAssign ko seed-menus-and-assign-people-module.js se PEHLE jaisa karne ke liye:
 * 1) Jo naye assigns seed ne banaye (storefront + homepage/sections) — un MenuAssign docs ko delete.
 * 2) Jo 4 masters seed ne People par shift kiye (Menu/MenuAssign/Module/Icon) — unhe wapas
 *    RESTORE_MASTERS_TO_MODULE par (default: Home).
 *
 * Agar pehle ye 4 kisi aur module par the, run karte waqt set karo:
 *   RESTORE_MASTERS_TO_MODULE=Package Master
 *
 * Run:
 *   node scripts/restore-menuassign-before-people-seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const MenuMaster = require('../modal/menumaster');
const ModuleMaster = require('../modal/modulemaster');
const MenuAssignMaster = require('../modal/menuassignmaster');

const RESTORE_MASTERS_TO_MODULE = process.env.RESTORE_MASTERS_TO_MODULE || 'Home';

/** Seed script ne in par naye assigns banaye the — hata do (MenuMaster rows rehti hain). */
const REMOVE_ASSIGN_ALIASES = [
    'storefronthomepage',
    'storefrontsections',
    'storefront-demifinesection',
    'storefront-topstyles',
    'storefront-discountbanner',
    'storefront-shopbyrecipient',
    'storefront-foreveryyou',
    'storefront-finegold',
    'storefront-deservetoshine',
    'storefront-foundermessage',
    'storefront-blogsection',
    'storefront-shopwithconfidence',
    'storefront-brandstory',
    'storefront-reviews',
    'storefront-ctabanner',
];

/** Seed ne inhe People par shift kiya tha — pehle Home (ya env) par the. */
const MOVE_MASTERS_ALIASES = ['menumaster', 'menuassignmaster', 'modulemaster', 'iconmaster'];

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Mongo connected');

    const targetMod = await ModuleMaster.findOne({
        module: RESTORE_MASTERS_TO_MODULE,
        status: 1,
    });
    if (!targetMod) {
        console.error('Module not found:', RESTORE_MASTERS_TO_MODULE);
        process.exit(1);
    }

    const menusRemove = await MenuMaster.find({
        aliasname: { $in: REMOVE_ASSIGN_ALIASES },
    }).select('_id aliasname');
    const idsRemove = menusRemove.map((m) => m._id);
    if (idsRemove.length) {
        const del = await MenuAssignMaster.deleteMany({ menuid: { $in: idsRemove } });
        console.log(
            'Deleted MenuAssign for storefront/homepage (count):',
            del.deletedCount,
            'menus matched:',
            menusRemove.length
        );
    } else {
        console.log('No menus found for storefront removal list (maybe already clean).');
    }

    for (const alias of MOVE_MASTERS_ALIASES) {
        const menu = await MenuMaster.findOne({ aliasname: alias });
        if (!menu) {
            console.warn('Menu missing alias:', alias);
            continue;
        }
        const assign = await MenuAssignMaster.findOne({ menuid: menu._id });
        if (!assign) {
            console.warn('No MenuAssign for:', alias);
            continue;
        }
        assign.moduleid = targetMod._id;
        assign.module = targetMod.module;
        if (!assign.recordinfo) assign.recordinfo = {};
        assign.recordinfo.updateby = 'restore-menuassign-before-people-seed';
        await assign.save();
        console.log('Moved assign', alias, '→', targetMod.module);
    }

    console.log('Done.');
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
