/**
 * Fills Country Master `currencycode` (ISO 4217) from ISO 3166-1 alpha-2 `countrycode`
 * using the `country-to-currency` mapping (default currency per country).
 *
 * Run (from backend folder):
 *   node scripts/backfill-country-currency-codes.js
 *   node scripts/backfill-country-currency-codes.js --force
 *
 * Default: only updates rows where `currencycode` is empty/missing.
 * --force: overwrites every row that has a mapping (251 countries).
 *
 * Requires: MONGO_URI in .env (or falls back to mongodb://localhost:27017/common-project)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const CountryMaster = require('../modal/countrymaster');
const countryToCurrency = require('country-to-currency');

const FORCE = process.argv.includes('--force');

async function main() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(uri);

    const countries = await CountryMaster.find({}).lean();
    let updated = 0;
    let skippedAlready = 0;
    let skippedNoMapping = 0;
    const now = new Date();

    for (const c of countries) {
        const code = String(c.countrycode || '')
            .trim()
            .toUpperCase();
        if (!code) {
            skippedNoMapping++;
            console.warn('Row without countrycode:', c._id, c.countryname);
            continue;
        }

        const mapped = countryToCurrency[code];
        if (!mapped) {
            skippedNoMapping++;
            console.warn('No ISO currency mapping for country code:', code, c.countryname);
            continue;
        }

        const next = String(mapped).trim().toUpperCase();
        const current = String(c.currencycode || '')
            .trim()
            .toUpperCase();

        if (!FORCE && current) {
            skippedAlready++;
            continue;
        }

        if (FORCE && current === next) {
            skippedAlready++;
            continue;
        }

        await CountryMaster.updateOne(
            { _id: c._id },
            {
                $set: {
                    currencycode: next,
                    'recordinfo.updateat': now,
                    'recordinfo.updateby': 'script:backfill-country-currency-codes',
                },
            }
        );
        updated++;
    }

    console.log('— Country currency backfill done —');
    console.log({
        totalRows: countries.length,
        updated,
        skippedAlreadySet: skippedAlready,
        skippedNoCountryCodeOrMapping: skippedNoMapping,
        force: FORCE,
    });

    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
