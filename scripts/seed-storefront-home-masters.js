require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const GeneralSetting = require('../modal/generalsetting');
const { getDefaultStorefrontHomeContent } = require('../data/storefrontHomeDefaultContent');

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    await mongoose.connect(uri);
    const username = process.env.SEED_CREATEBY || 'system';

    const DEFAULT_CONTENT = getDefaultStorefrontHomeContent();

    let doc = await GeneralSetting.findOne().sort({ 'recordinfo.createat': -1 });
    if (!doc) {
        doc = await GeneralSetting.create({
            storeName: 'ORINKET',
            recordinfo: { createby: username },
            storefrontContentJson: JSON.stringify(DEFAULT_CONTENT, null, 2),
        });
        console.log('Created new general setting with homepage masters dummy data (14 sections, Cloudinary image URLs).');
    } else {
        doc.storefrontContentJson = JSON.stringify(DEFAULT_CONTENT, null, 2);
        if (!doc.recordinfo || typeof doc.recordinfo !== 'object') doc.recordinfo = {};
        doc.recordinfo.updateby = username;
        doc.recordinfo.updateat = Date.now();
        await doc.save();
        console.log('Updated existing general setting with homepage masters dummy data (14 sections, Cloudinary image URLs).');
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
