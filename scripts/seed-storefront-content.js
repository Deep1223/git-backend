require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const GeneralSetting = require('../modal/generalsetting');
const { getDefaultStorefrontHomeContent } = require('../data/storefrontHomeDefaultContent');
const img = require('../config/storefrontCloudinaryPlaceholders');

/** Hero carousel — Cloudinary demo URLs (same pattern as storefront section images). */
const DEFAULT_HERO_SLIDES = [
    {
        image: img.hero1,
        title: 'BUY ONE GET ONE FREE',
        subtitle: 'Double the sparkle — two pieces, one checkout',
        caption: '',
        cta: 'SHOP NOW',
        href: '',
        buyOneGetOneFree: true,
        discountUpTo: 0,
    },
    {
        image: img.hero2,
        title: 'LIMITED TIME',
        subtitle: 'Up to 50% off selected demi-fine jewellery',
        caption: '',
        cta: 'SHOP SALE',
        href: '',
        buyOneGetOneFree: false,
        discountUpTo: 50,
    },
];

const DEFAULT_CONTENT = getDefaultStorefrontHomeContent();

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');
    await mongoose.connect(uri);

    const createby = process.env.SEED_CREATEBY || 'system';
    const force = process.env.FORCE_OVERWRITE === '1';
    let doc = await GeneralSetting.findOne().sort({ 'recordinfo.createat': -1 });
    if (!doc) {
        doc = new GeneralSetting({
            heroSlides: DEFAULT_HERO_SLIDES,
            storefrontContentJson: JSON.stringify(DEFAULT_CONTENT, null, 2),
            recordinfo: { createby },
        });
        await doc.save();
        console.log('Created GeneralSetting with seeded storefront content.');
    } else {
        const patch = {};
        if (force || !Array.isArray(doc.heroSlides) || doc.heroSlides.length === 0) patch.heroSlides = DEFAULT_HERO_SLIDES;
        if (force || !String(doc.storefrontContentJson || '').trim()) {
            patch.storefrontContentJson = JSON.stringify(DEFAULT_CONTENT, null, 2);
        }
        if (Object.keys(patch).length === 0) {
            console.log('GeneralSetting already has content; nothing changed. Use FORCE_OVERWRITE=1 to replace.');
        } else {
            patch.recordinfo = { ...(doc.recordinfo || {}), updateby: createby, updateat: Date.now() };
            await GeneralSetting.findByIdAndUpdate(doc._id, { $set: patch }, { new: true, runValidators: true });
            console.log('Updated GeneralSetting with seeded storefront content fields.');
        }
    }

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
