/**
 * Replace GeneralSetting.heroSlides with exactly two slides (BOGO + discount %).
 * Images: hero jewellery stock URLs from storefrontCloudinaryPlaceholders.js (Unsplash)
 *
 * Run: cd backend && node scripts/reset-hero-slides.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const GeneralSetting = require('../modal/generalsetting');
const img = require('../config/storefrontCloudinaryPlaceholders');

const HERO_SLIDES_TWO = [
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

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');
    await mongoose.connect(uri);

    const doc = await GeneralSetting.findOne().sort({ 'recordinfo.createat': -1 });
    if (!doc) {
        console.error('No GeneralSetting document found. Run seed-storefront-content.js first.');
        process.exit(1);
    }

    const createby = process.env.SEED_CREATEBY || 'system';
    await GeneralSetting.findByIdAndUpdate(
        doc._id,
        {
            $set: {
                heroSlides: HERO_SLIDES_TWO,
                'recordinfo.updateby': createby,
                'recordinfo.updateat': Date.now(),
            },
        },
        { new: true, runValidators: true }
    );

    console.log('heroSlides replaced with 2 slides (BOGO + up to 50% off), hero image URLs updated.');
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
