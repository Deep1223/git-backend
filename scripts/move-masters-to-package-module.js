/**
 * Menu Master, Menu Assign, Module Master, Icon Master ke MenuAssign ko
 * Package Master module par set karta hai (Home se ya kisi aur se).
 *
 * Kyun: seed script ne ye menus People par shift kiye the; restore ne Home par rakha tha.
 * Agar tumhara layout Package Master par in masters ke saath tha, ye script wapas laati hai.
 *
 * Run:
 *   node scripts/move-masters-to-package-module.js
 *
 * Optional:
 *   TARGET_MODULE_NAME=Package Master   (default)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const MenuMaster = require('../modal/menumaster');
const ModuleMaster = require('../modal/modulemaster');
const MenuAssignMaster = require('../modal/menuassignmaster');

const TARGET_MODULE_NAME = process.env.TARGET_MODULE_NAME || 'Package Master';

const ALIASES = ['menumaster', 'menuassignmaster', 'modulemaster', 'iconmaster'];

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing');
        process.exit(1);
    }
    await mongoose.connect(uri);

    const mod = await ModuleMaster.findOne({ module: TARGET_MODULE_NAME, status: 1 });
    if (!mod) {
        console.error('Module not found:', TARGET_MODULE_NAME);
        process.exit(1);
    }

    for (const alias of ALIASES) {
        const menu = await MenuMaster.findOne({ aliasname: alias });
        if (!menu) {
            console.warn('Skip (no menu):', alias);
            continue;
        }
        let assign = await MenuAssignMaster.findOne({ menuid: menu._id });
        if (!assign) {
            assign = await MenuAssignMaster.create({
                moduleid: mod._id,
                module: mod.module,
                menuid: menu._id,
                menu: menu.menuname,
                status: 1,
                recordinfo: { createby: 'move-masters-to-package-module' },
            });
            console.log('Created assign', alias, '→', mod.module);
            continue;
        }
        assign.moduleid = mod._id;
        assign.module = mod.module;
        assign.menu = menu.menuname;
        assign.status = 1;
        if (!assign.recordinfo) assign.recordinfo = {};
        assign.recordinfo.updateby = 'move-masters-to-package-module';
        await assign.save();
        console.log('Moved', alias, '→', mod.module);
    }

    console.log('Done.');
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
