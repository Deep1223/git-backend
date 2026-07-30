/**
 * Replace every "orinket" / "Orinket" / "ORINKET" occurrence across all collections,
 * preserving the original casing style with TrishaJewells equivalents.
 *
 * Run: node scripts/replace-brand-orinket.js
 * Dry-run: node scripts/replace-brand-orinket.js --dry-run
 */
require('dotenv-vault').config();
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const DRY_RUN = process.argv.includes('--dry-run');

const REPLACEMENTS = [
  // longest / most specific first
  { from: /ORINKET/g, to: 'TRISHAJEWELLS' },
  { from: /Orinket/g, to: 'TrishaJewells' },
  { from: /orinket/g, to: 'trishajewells' },
];

function replaceInString(value) {
  if (typeof value !== 'string' || !/orinket/i.test(value)) return { value, changed: false };
  let next = value;
  for (const { from, to } of REPLACEMENTS) {
    next = next.replace(from, to);
  }
  return { value: next, changed: next !== value };
}

function walk(node) {
  if (node == null) return { value: node, changed: false };

  if (typeof node === 'string') {
    return replaceInString(node);
  }

  if (typeof node !== 'object') {
    return { value: node, changed: false };
  }

  // Leave Mongo special types alone (ObjectId, Date, Buffer, Decimal128, etc.)
  if (
    node instanceof mongoose.Types.ObjectId ||
    node instanceof Date ||
    Buffer.isBuffer(node) ||
    node._bsontype
  ) {
    return { value: node, changed: false };
  }

  if (Array.isArray(node)) {
    let changed = false;
    const arr = node.map((item) => {
      const r = walk(item);
      if (r.changed) changed = true;
      return r.value;
    });
    return { value: arr, changed };
  }

  let changed = false;
  const out = {};
  for (const [key, val] of Object.entries(node)) {
    // Also rename keys that contain orinket (rare)
    let nextKey = key;
    if (/orinket/i.test(key)) {
      for (const { from, to } of REPLACEMENTS) {
        nextKey = nextKey.replace(from, to);
      }
      if (nextKey !== key) changed = true;
    }
    const r = walk(val);
    if (r.changed) changed = true;
    out[nextKey] = r.value;
  }
  return { value: out, changed };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI missing in .env');

  await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  console.log(`Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  console.log(DRY_RUN ? 'MODE: dry-run (no writes)' : 'MODE: live replace');

  const collections = await db.listCollections().toArray();
  let docsScanned = 0;
  let docsUpdated = 0;
  const byCollection = [];

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const col = db.collection(name);

    // Fast prefilter: only docs whose BSON stringify-ish fields might contain orinket
    // Use $where is slow; instead scan all and check in JS (91 cols, fine for one-off).
    const cursor = col.find({});
    let updatedHere = 0;
    let scannedHere = 0;
    const samples = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scannedHere += 1;
      docsScanned += 1;

      const { _id, ...rest } = doc;
      const { value: nextRest, changed } = walk(rest);
      if (!changed) continue;

      updatedHere += 1;
      docsUpdated += 1;
      if (samples.length < 3) {
        samples.push(String(_id));
      }

      if (!DRY_RUN) {
        await col.replaceOne({ _id }, { _id, ...nextRest });
      }
    }

    if (updatedHere > 0) {
      byCollection.push({ name, scanned: scannedHere, updated: updatedHere, samples });
      console.log(`✓ ${name}: updated ${updatedHere}/${scannedHere}`);
    }
  }

  console.log('\n==== SUMMARY ====');
  console.log(`Docs scanned: ${docsScanned}`);
  console.log(`Docs updated: ${docsUpdated}`);
  console.log('Collections touched:', byCollection.length);
  for (const row of byCollection) {
    console.log(`  - ${row.name}: ${row.updated} (e.g. ${row.samples.join(', ')})`);
  }

  // Verify generalsettings
  const gs = await db.collection('generalsettings').findOne(
    {},
    { projection: { storeName: 1, brandName: 1, metaTitle: 1, seoHomepageTitle: 1 } }
  );
  console.log('\ngeneralsettings now:', JSON.stringify(gs, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
