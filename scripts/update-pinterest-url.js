require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const GeneralSetting = require('../modal/generalsetting');

(async () => {
  // Use existing MONGO_URI or fallback to common-project (from server.js)
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
  await mongoose.connect(MONGO_URI);
  
  // Find all general settings (usually there's only one)
  const settings = await GeneralSetting.find({});
  let updatedCount = 0;

  if (settings.length === 0) {
    console.log('No GeneralSetting records found to update.');
  } else {
    for (const doc of settings) {
      // Set the Pinterest URL
      doc.pinterestUrl = 'https://www.pinterest.com/orinket_jewellery/';
      // Ensure other fields are as requested (X/Twitter is already handled via UI, but we can ensure it here)
      if (!doc.twitterUrl) doc.twitterUrl = 'https://x.com/';
      
      await doc.save();
      console.log('Saved document with pinterestUrl:', doc.pinterestUrl);
      updatedCount++;
    }
    console.log(`Updated ${updatedCount} GeneralSetting record(s).`);
  }
  
  // Re-fetch to be absolutely sure
  const updatedDoc = await GeneralSetting.findOne({});
  console.log('Verification fetch pinterestUrl:', updatedDoc.pinterestUrl);
  
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
