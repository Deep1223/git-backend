/**
 * Node runner for insert_subcategories.js data (mongosh optional).
 * Usage: node scripts/run-insert-subcategories.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SubCategoryMaster = require('../modal/subcategorymaster');

const oid = (hex) => new mongoose.Types.ObjectId(hex);

const now = new Date();
const admin = 'Admin Admin';

const subcategories = [
  { subcategoryname: 'Engagement Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Wedding Bands', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Solitaire Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Cocktail Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Eternity Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Statement Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Stackable Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Promise Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Adjustable Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Temple Rings', category: 'Rings', categoryid: oid('69c79fdd757ac2e73bdd72c9') },
  { subcategoryname: 'Choker Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Pendant Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Layered Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Mangalsutra', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Temple Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Coin Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Beaded Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Locket Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Collar Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Opera Necklaces', category: 'Necklaces', categoryid: oid('69c7a150757ac2e73bdd72ec') },
  { subcategoryname: 'Stud Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Hoop Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Drop Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Jhumka Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Chandelier Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Clip-On Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Ear Cuffs', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Threader Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Dangle Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Bali Earrings', category: 'Earrings', categoryid: oid('69c7a17a757ac2e73bdd7303') },
  { subcategoryname: 'Bangle Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Charm Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Tennis Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Cuff Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Kada Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Stackable Bracelets', category: 'Bracelets', categoryid: oid('69c7a189757ac2e73bdd730b') },
  { subcategoryname: 'Cuban Link Chains', category: 'Chains', categoryid: oid('69c7a19b757ac2e73bdd7313') },
  { subcategoryname: 'Rope Chains', category: 'Chains', categoryid: oid('69c7a19b757ac2e73bdd7313') },
  { subcategoryname: 'Figaro Chains', category: 'Chains', categoryid: oid('69c7a19b757ac2e73bdd7313') },
  { subcategoryname: 'Snake Chains', category: 'Chains', categoryid: oid('69c7a19b757ac2e73bdd7313') },
  { subcategoryname: 'Bridal Necklace Sets', category: 'Bridal Collection', categoryid: oid('69c7a1af757ac2e73bdd731b') },
  { subcategoryname: 'Bridal Bangles', category: 'Bridal Collection', categoryid: oid('69c7a1af757ac2e73bdd731b') },
  { subcategoryname: 'Bridal Maang Tikka', category: 'Bridal Collection', categoryid: oid('69c7a1af757ac2e73bdd731b') },
  { subcategoryname: 'Bridal Earrings', category: 'Bridal Collection', categoryid: oid('69c7a1af757ac2e73bdd731b') },
  { subcategoryname: 'Bridal Full Sets', category: 'Bridal Collection', categoryid: oid('69c7a1af757ac2e73bdd731b') },
  { subcategoryname: "Men's Rings", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: "Men's Chains", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: "Men's Bracelets", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: "Men's Kadas", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: "Men's Pendants", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: "Men's Cufflinks", category: "Men's Collection", categoryid: oid('69c7a1c9757ac2e73bdd7323') },
  { subcategoryname: 'Birthday Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: 'Anniversary Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: 'Wedding Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: 'Festival Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: 'Valentine Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: "Mother's Day Gifts", category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
  { subcategoryname: 'Corporate Gifts', category: 'Gifts', categoryid: oid('69c7a1f97f18fd83df61d0ef') },
];

const docs = subcategories.map((item) => ({
  ...item,
  status: 1,
  recordinfo: { createby: admin, createat: now },
  __v: 0,
}));

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI missing in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  try {
    const created = await SubCategoryMaster.insertMany(docs, { ordered: false });
    console.log(`Total inserted: ${created.length} subcategories`);
  } catch (err) {
    if (err.name === 'MongoBulkWriteError' && err.insertedDocs) {
      console.log(`Partial insert: ${err.insertedDocs.length} inserted, some duplicates skipped.`);
      if (err.writeErrors?.length) {
        console.log(`Write errors (e.g. duplicate): ${err.writeErrors.length}`);
      }
    } else {
      throw err;
    }
  }
  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
