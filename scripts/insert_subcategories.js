// ============================================================
// Jewelry Subcategories Insert Script
// Run: mongosh <your_database_name> insert_subcategories.js
// Ya shell ke andar: load("insert_subcategories.js")
//
// Collection: SubCategoryMaster (Mongoose) → subcategorymasters
// ============================================================

const now = new Date();
const admin = "Admin Admin";

const subcategories = [

  // ── 1. RINGS — 10 subcategories (69c79fdd757ac2e73bdd72c9) ──
  { subcategoryname: "Engagement Rings",     category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Wedding Bands",        category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Solitaire Rings",      category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Cocktail Rings",       category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Eternity Rings",       category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Statement Rings",      category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Stackable Rings",      category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Promise Rings",        category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Adjustable Rings",     category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },
  { subcategoryname: "Temple Rings",         category: "Rings", categoryid: ObjectId("69c79fdd757ac2e73bdd72c9") },

  // ── 2. NECKLACES — 10 subcategories (69c7a150757ac2e73bdd72ec) ──
  { subcategoryname: "Choker Necklaces",     category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Pendant Necklaces",    category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Layered Necklaces",    category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Mangalsutra",          category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Temple Necklaces",     category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Coin Necklaces",       category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Beaded Necklaces",     category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Locket Necklaces",     category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Collar Necklaces",     category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },
  { subcategoryname: "Opera Necklaces",      category: "Necklaces", categoryid: ObjectId("69c7a150757ac2e73bdd72ec") },

  // ── 3. EARRINGS — 10 subcategories (69c7a17a757ac2e73bdd7303) ──
  { subcategoryname: "Stud Earrings",        category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Hoop Earrings",        category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Drop Earrings",        category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Jhumka Earrings",      category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Chandelier Earrings",  category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Clip-On Earrings",     category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Ear Cuffs",            category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Threader Earrings",    category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Dangle Earrings",      category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },
  { subcategoryname: "Bali Earrings",        category: "Earrings", categoryid: ObjectId("69c7a17a757ac2e73bdd7303") },

  // ── 4. BRACELETS — 6 subcategories (69c7a189757ac2e73bdd730b) ──
  { subcategoryname: "Bangle Bracelets",     category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },
  { subcategoryname: "Charm Bracelets",      category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },
  { subcategoryname: "Tennis Bracelets",     category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },
  { subcategoryname: "Cuff Bracelets",       category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },
  { subcategoryname: "Kada Bracelets",       category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },
  { subcategoryname: "Stackable Bracelets",  category: "Bracelets", categoryid: ObjectId("69c7a189757ac2e73bdd730b") },

  // ── 5. CHAINS — 4 subcategories (69c7a19b757ac2e73bdd7313) ──
  { subcategoryname: "Cuban Link Chains",    category: "Chains", categoryid: ObjectId("69c7a19b757ac2e73bdd7313") },
  { subcategoryname: "Rope Chains",          category: "Chains", categoryid: ObjectId("69c7a19b757ac2e73bdd7313") },
  { subcategoryname: "Figaro Chains",        category: "Chains", categoryid: ObjectId("69c7a19b757ac2e73bdd7313") },
  { subcategoryname: "Snake Chains",         category: "Chains", categoryid: ObjectId("69c7a19b757ac2e73bdd7313") },

  // ── 6. BRIDAL COLLECTION — 5 subcategories (69c7a1af757ac2e73bdd731b) ──
  { subcategoryname: "Bridal Necklace Sets", category: "Bridal Collection", categoryid: ObjectId("69c7a1af757ac2e73bdd731b") },
  { subcategoryname: "Bridal Bangles",       category: "Bridal Collection", categoryid: ObjectId("69c7a1af757ac2e73bdd731b") },
  { subcategoryname: "Bridal Maang Tikka",   category: "Bridal Collection", categoryid: ObjectId("69c7a1af757ac2e73bdd731b") },
  { subcategoryname: "Bridal Earrings",      category: "Bridal Collection", categoryid: ObjectId("69c7a1af757ac2e73bdd731b") },
  { subcategoryname: "Bridal Full Sets",     category: "Bridal Collection", categoryid: ObjectId("69c7a1af757ac2e73bdd731b") },

  // ── 7. MEN'S COLLECTION — 6 subcategories (69c7a1c9757ac2e73bdd7323) ──
  { subcategoryname: "Men's Rings",          category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },
  { subcategoryname: "Men's Chains",         category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },
  { subcategoryname: "Men's Bracelets",      category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },
  { subcategoryname: "Men's Kadas",          category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },
  { subcategoryname: "Men's Pendants",       category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },
  { subcategoryname: "Men's Cufflinks",      category: "Men's Collection", categoryid: ObjectId("69c7a1c9757ac2e73bdd7323") },

  // ── 8. GIFTS — 7 subcategories (69c7a1f97f18fd83df61d0ef) ──
  { subcategoryname: "Birthday Gifts",       category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Anniversary Gifts",    category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Wedding Gifts",        category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Festival Gifts",       category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Valentine Gifts",      category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Mother's Day Gifts",   category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },
  { subcategoryname: "Corporate Gifts",      category: "Gifts", categoryid: ObjectId("69c7a1f97f18fd83df61d0ef") },

];

// ── Common fields add karo ───────────────────────────────────
const docs = subcategories.map(item => ({
  ...item,
  status: 1,
  recordinfo: {
    createby: admin,
    createat: now
  },
  __v: 0
}));

// ── Insert ───────────────────────────────────────────────────
const result = db.subcategorymasters.insertMany(docs);

print("✅ Total inserted: " + result.insertedCount + " subcategories");
print("📦 Category-wise breakdown:");
print("   Rings             : 10");
print("   Necklaces         : 10");
print("   Earrings          : 10");
print("   Bracelets         :  6");
print("   Chains            :  4");
print("   Bridal Collection :  5");
print("   Men's Collection  :  6");
print("   Gifts             :  7");
print("   ─────────────────────");
print("   Total             : 58");
