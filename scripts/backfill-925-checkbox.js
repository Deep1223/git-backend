require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Product = require('../modal/productmaster');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const r = await Product.updateMany(
    { storefrontHomeSectionKeys: 'fineGoldProducts' },
    { $set: { showIn925SilverPost: true } }
  );
  console.log('matched', r.matchedCount, 'modified', r.modifiedCount);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
