const { BRAND } = require('../config/brand');
/**
 * Upserts default promo rows into `promo_codes` (same rules as legacy STATIC_PROMOS).
 * After this, manage codes in Mongo (Compass / admin) — storefront validates via POST /api/promo/validate.
 *
 * Run: cd backend && node scripts/seed-promo-codes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PromoCode = require('../modal/promocodemaster');

const SEED = [
    { code: BRAND.promoCode10, type: 'percent', value: 10, minOrder: 0, description: '10% off your order' },
    { code: 'WELCOME15', type: 'percent', value: 15, minOrder: 0, description: '15% off your order' },
    { code: 'FEST500', type: 'fixed', value: 500, minOrder: 2000, description: '₹500 off' },
    { code: 'GOLD100', type: 'fixed', value: 100, minOrder: 500, description: '₹100 off' },
];

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in backend/.env');

    await mongoose.connect(uri);

    for (const p of SEED) {
        await PromoCode.updateOne(
            { code: p.code },
            {
                $set: {
                    type: p.type,
                    value: p.value,
                    minOrder: p.minOrder,
                    isActive: true,
                    description: p.description,
                    validFrom: null,
                    validTo: null,
                    maxRedemptions: null,
                },
            },
            { upsert: true }
        );
        console.log('Upserted', p.code);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
