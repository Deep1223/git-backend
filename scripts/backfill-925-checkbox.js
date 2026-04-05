require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const Product = require('../modal/productmaster');

const SILVER_925_SECTION_KEY = 'showIn925SilverPost';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rows = await Product.find({}).select('_id showIn925SilverPost storefrontHomeSectionKeys').lean();
  let modified = 0;
  for (const row of rows) {
    const keySet = new Set(
      Array.isArray(row.storefrontHomeSectionKeys)
        ? row.storefrontHomeSectionKeys.map((x) => String(x || '').trim()).filter(Boolean)
        : []
    );
    if (row.showIn925SilverPost === true) keySet.add(SILVER_925_SECTION_KEY);
    else keySet.delete(SILVER_925_SECTION_KEY);

    const nextKeys = [...keySet];
    const changed =
      JSON.stringify(nextKeys) !==
      JSON.stringify(
        Array.isArray(row.storefrontHomeSectionKeys)
          ? row.storefrontHomeSectionKeys.map((x) => String(x || '').trim()).filter(Boolean)
          : []
      );
    if (!changed) continue;

    await Product.updateOne({ _id: row._id }, { $set: { storefrontHomeSectionKeys: nextKeys } });
    modified += 1;
  }
  console.log('migrated products', modified);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
