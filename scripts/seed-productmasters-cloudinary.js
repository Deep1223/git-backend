const { BRAND } = require('../config/brand');
/**
 * Seed ProductMaster with 150+ products using images from Cloudinary or local folders.
 *
 * Prerequisites (backend/.env):
 *   MONGO_URI
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Default: scans **project root** folders (same as your project image tree):
 *   bridal/, Earrings/, mans/, Necklaces/, ring/
 *   Uploads each file to Cloudinary under <brand>/<folder>/… then seeds DB.
 *   Products from a folder map to that jewellery category (Rings, Earrings, etc.).
 *
 * If no local images are found, falls back to listing Cloudinary prefixes:
 *   brand category folders
 *
 * Run:  cd backend && node scripts/seed-productmasters-cloudinary.js
 *
 * Product codes (productseries) are not set by this script (insertMany skips mongoose hooks).
 * After seeding, run:
 *   node scripts/ensure-product-series-master.js
 *   node scripts/backfill-product-series-and-clean-names.js
 *
 * Optional env:
 *   MIN_PRODUCTS=180
 *   SEED_CREATEBY=Admin Admin
 *   EXTRA_IMAGES_PER_PRODUCT=3
 *   SEED_LOCAL_ROOT=<project-root>   (override project root for image folders)
 *   SEED_SKIP_LOCAL=1             (only use Cloudinary API list, no local upload)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const SubCategoryMaster = require('../modal/subcategorymaster');
const ProductMaster = require('../modal/productmaster');

const FOLDER_PREFIXES = [
    BRAND.categoryFolders[0],
    BRAND.categoryFolders[1],
    BRAND.categoryFolders[2],
    BRAND.categoryFolders[3],
    BRAND.categoryFolders[4],
];

/** Local folder name (under project root) → ProductMaster.category in DB */
const LOCAL_FOLDER_MAP = [
    { dir: 'bridal', category: 'Bridal Collection' },
    { dir: 'Earrings', category: 'Earrings' },
    { dir: 'mans', category: "Men's Collection" },
    { dir: 'Necklaces', category: 'Necklaces' },
    { dir: 'ring', category: 'Rings' },
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp', '.svg']);

const MIN_PRODUCTS = Math.max(150, parseInt(process.env.MIN_PRODUCTS || '160', 10) || 160);
const SEED_CREATEBY = process.env.SEED_CREATEBY || 'Admin Admin';
const EXTRA_IMAGES = Math.max(0, parseInt(process.env.EXTRA_IMAGES_PER_PRODUCT || '3', 10) || 3);

const MATERIALS = ['Gold (18KT)', 'Gold (22KT)', 'Gold (14KT)', 'Rose Gold', 'White Gold'];
const PLATINGS = ['Gold Plated', 'Rose Gold Plated', 'Rhodium Plated', 'Antique Finish'];
const WIDTHS = ['2mm', '2.5mm', '2.8mm', '3mm', '3.5mm', '4mm'];
const WEIGHTS = ['3.5 grams', '4 grams', '4.5 grams', '5 grams', '5.5 grams', '6 grams', '8 grams'];

const ADJECTIVES = [
    'Elegant',
    'Royal',
    'Classic',
    'Premium',
    'Artisan',
    'Heritage',
    'Luxe',
    'Timeless',
    'Signature',
    'Designer',
    'Regal',
    'Graceful',
    'Refined',
    'Opulent',
    'Contemporary',
];

/**
 * Rich copy per subcategory: proper retail-style names & descriptions.
 * Keys must match SubCategoryMaster.subcategoryname exactly.
 */
const SUBCATEGORY_COPY = {
    'Engagement Rings': {
        epithets: [
            'Diamond-Cut Solitaire',
            'Cathedral-Set Halo',
            'Vintage-Inspired Cluster',
            'Minimal Bezel Solitaire',
            'Split-Shank Pavé',
            'Floral Accent Solitaire',
            'Twisted Band Promise Style',
            'Cushion Halo Setting',
        ],
        audience: 'Women',
        dim: ['Band width: 2.5mm', 'Band width: 3mm', 'Band width: 3.5mm', 'Centre setting: 6mm', 'Centre setting: 6.5mm'],
        bullets: [
            'Designed for proposals and milestone moments',
            'Bright, even polish for maximum shine',
            'Comfort-fit inner profile for daily wear',
            'Pairs beautifully with wedding bands',
        ],
    },
    'Wedding Bands': {
        epithets: [
            'Classic Court Band',
            'Milgrain Edge Band',
            'Half-Eternity Accent',
            'Hammered Texture Band',
            'Step-Edge Comfort Fit',
            'Satin-Finish Dome',
            'Channel-Set Accent Band',
            'Plain High-Polish Band',
        ],
        audience: 'Women',
        dim: ['Band width: 3mm', 'Band width: 4mm', 'Band width: 5mm', 'Comfort fit profile'],
        bullets: [
            'Ideal for wedding ceremonies and anniversaries',
            'Balanced weight for all-day comfort',
            'Matches a wide range of engagement rings',
            'Durable finish for everyday wear',
        ],
    },
    'Solitaire Rings': {
        epithets: [
            'Single-Stone Highlight',
            'Tapered Shank Solitaire',
            'Four-Prong Classic',
            'Low-Profile Solitaire',
            'Knife-Edge Solitaire',
            'Rounded Solitaire Crown',
        ],
        audience: 'Women',
        dim: ['Band width: 2.2mm', 'Band width: 2.8mm', 'Stone seat: low profile'],
        bullets: [
            'Clean, timeless single-stone look',
            'Understated elegance for office and events',
            'Easy to stack with slim bands',
            'High-lustre polish',
        ],
    },
    'Cocktail Rings': {
        epithets: [
            'Statement Cluster',
            'Bold Geometric Face',
            'Art-Deco Inspired',
            'Wide Top Cocktail',
            'Asymmetric Design',
            'Layered Stone Layout',
        ],
        audience: 'Women',
        dim: ['Face width: 12mm', 'Face width: 14mm', 'Face width: 16mm'],
        bullets: [
            'Made for parties, receptions, and festive nights',
            'Eye-catching silhouette without feeling bulky',
            'Pairs with evening and ethnic outfits',
            'Statement finish with smooth inner band',
        ],
    },
    'Eternity Rings': {
        epithets: [
            'Full-Circle Accent',
            'Shared-Prong Style',
            'Micro-Pavé Band',
            'Half-Eternity Style',
            'Scalloped Edge Eternity',
        ],
        audience: 'Women',
        dim: ['Band width: 2.5mm', 'Band width: 3mm', 'Full eternity layout'],
        bullets: [
            'Symbolic endless circle design',
            'Beautiful as a stacker or standalone',
            'Even spacing for a balanced look',
            'Anniversary and milestone favourite',
        ],
    },
    'Statement Rings': {
        epithets: [
            'Wide Band Statement',
            'Sculpted Face Ring',
            'Layered Metal Design',
            'Bold Openwork',
            'Heritage Motif Face',
        ],
        audience: 'Women',
        dim: ['Face height: 10mm', 'Face height: 12mm', 'Wide band: 8mm'],
        bullets: [
            'Designed to be the hero of your hand stack',
            'Strong presence with comfortable taper at shank',
            'Ideal for festivals and celebrations',
            'Hand-finished detailing',
        ],
    },
    'Stackable Rings': {
        epithets: [
            'Slim Stack Band',
            'Textured Stack Ring',
            'Chevron Stack',
            'Twist Stack Band',
            'Dotted Accent Stack',
        ],
        audience: 'Women',
        dim: ['Band width: 1.8mm', 'Band width: 2mm', 'Stack-friendly slim profile'],
        bullets: [
            'Mix and match with other stack rings',
            'Lightweight for multiple rings on one finger',
            'Creates a personalised layered story',
            'Great for daily rotation',
        ],
    },
    'Promise Rings': {
        epithets: [
            'Heart Motif Promise',
            'Infinity Knot Band',
            'Simple Knot Promise',
            'Petite Stone Accent',
            'Engravable Band Style',
        ],
        audience: 'Women',
        dim: ['Band width: 2mm', 'Band width: 2.5mm', 'Delicate profile'],
        bullets: [
            'A meaningful gift for commitments and milestones',
            'Subtle design suitable for younger wearers',
            'Comfortable for school, college, or work',
            'Sweet gesture for birthdays and Valentine’s',
        ],
    },
    'Adjustable Rings': {
        epithets: [
            'Open-Shank Adjustable',
            'Wrap-Style Adjustable',
            'Minimal Adjustable Band',
            'Leaf Wrap Adjustable',
        ],
        audience: 'Women',
        dim: ['Adjustable open size', 'Flexible shank — one size fits most'],
        bullets: [
            'Easy to resize slightly without a jeweller visit',
            'Great when gifting and size is unknown',
            'Smooth edges to avoid snagging',
            'Ideal for growing teens or gift hampers',
        ],
    },
    'Temple Rings': {
        epithets: [
            'Nakashi Temple Motif',
            'Lakshmi Inspired Detail',
            'Peacock Temple Border',
            'Heritage Temple Band',
            'South Indian Temple Work',
        ],
        audience: 'Women',
        dim: ['Motif face: 11mm', 'Motif face: 13mm', 'Heritage width: 9mm'],
        bullets: [
            'Traditional temple-inspired craftsmanship',
            'Pairs with silk sarees and festive attire',
            'Rich texture with antique or high polish options',
            'Celebration and wedding season favourite',
        ],
    },
    'Choker Necklaces': {
        epithets: [
            'Rigid Collar Choker',
            'Flexible Short Choker',
            'Temple Work Choker',
            'Minimal Gold Choker',
            'Layer-Ready Choker',
        ],
        audience: 'Women',
        dim: ['Length: 14 inches', 'Length: 15 inches', 'Adjustable hook: 14–15 inches'],
        bullets: [
            'Sits high on the neck for a modern silhouette',
            'Works with deep necklines and ethnic blouses',
            'Lightweight options for long events',
            'Easy clasp for self wear',
        ],
    },
    'Pendant Necklaces': {
        epithets: [
            'Solitaire Pendant Drop',
            'Floral Pendant Set',
            'Geometric Pendant',
            'Heart Pendant Chain',
            'Teardrop Pendant',
        ],
        audience: 'Women',
        dim: ['Chain: 16 inches', 'Chain: 18 inches', 'Adjustable 16–18 inches'],
        bullets: [
            'Versatile for office, college, and outings',
            'Pendant proportion balanced for daily wear',
            'Secure clasp and sturdy bail',
            'Layer with longer chains for a trendy stack',
        ],
    },
    'Layered Necklaces': {
        epithets: [
            'Two-Layer Station Chain',
            'Triple Strand Layer',
            'Mixed-Length Layer Set',
            'Delicate Double Layer',
        ],
        audience: 'Women',
        dim: ['Layers: 16 + 18 inches', 'Layers: 15 + 17 + 19 inches'],
        bullets: [
            'Pre-layered look — no styling guesswork',
            'Adds depth to simple kurtas and dresses',
            'Tangle-conscious spacing between strands',
            'One piece, full necklace stack effect',
        ],
    },
    Mangalsutra: {
        epithets: [
            'Short Black Bead Mangalsutra',
            'Diamond-Inspired Mangalsutra',
            'Lightweight Daily Mangalsutra',
            'Traditional Two-Strand',
            'Contemporary Mangalsutra Pendant',
        ],
        audience: 'Women',
        dim: ['Length: 16 inches', 'Length: 18 inches', 'Short daily: 15 inches'],
        bullets: [
            'Designed for married women who wear mangalsutra daily',
            'Balanced black bead spacing',
            'Pairs with Indian and fusion workwear',
            'Sacred symbolism with modern wearability',
        ],
    },
    'Temple Necklaces': {
        epithets: [
            'Lakshmi Temple Necklace',
            'Peacock Panel Necklace',
            'Heritage Coin Temple',
            'Layered Temple Haram Short',
        ],
        audience: 'Women',
        dim: ['Necklace drop: short haram', 'Princess length with temple panels'],
        bullets: [
            'Statement piece for weddings and poojas',
            'Rich South Indian design language',
            'Matches temple earrings and jhumkas',
            'Hand-finished motif clarity',
        ],
    },
    'Coin Necklaces': {
        epithets: [
            'Laxmi Coin Pendant',
            'Heritage Coin Drop',
            'Double Coin Station',
            'Antique Coin Motif',
        ],
        audience: 'Women',
        dim: ['Coin motif: 18mm', 'Coin motif: 22mm', 'Chain: 18 inches'],
        bullets: [
            'Auspicious coin symbolism for festive wear',
            'Works with sarees and lehengas',
            'Solid feel with smooth edges',
            'Popular for housewarming and wedding gifts',
        ],
    },
    'Beaded Necklaces': {
        epithets: [
            'Gold Bead Strand',
            'Mixed Bead Station',
            'Ball Chain Necklace',
            'Graduated Bead Row',
        ],
        audience: 'Women',
        dim: ['Length: 18 inches', 'Length: 20 inches', 'Multi-strand short'],
        bullets: [
            'Textured look that catches light beautifully',
            'Casual to semi-formal versatility',
            'Comfortable rounded beads on skin',
            'Easy to pair with studs or hoops',
        ],
    },
    'Locket Necklaces': {
        epithets: [
            'Classic Oval Locket',
            'Heart Locket Pendant',
            'Minimal Round Locket',
            'Engravable Locket Style',
        ],
        audience: 'Women',
        dim: ['Locket: 18mm', 'Locket: 20mm', 'Chain: 18 inches'],
        bullets: [
            'Personal keepsake for photos or tiny mementos',
            'Thoughtful gift for family milestones',
            'Secure hinge and bail',
            'Heirloom-style emotional value',
        ],
    },
    'Collar Necklaces': {
        epithets: [
            'Structured Collar Band',
            'Wide Collar Necklace',
            'Artistic Collar Plate',
        ],
        audience: 'Women',
        dim: ['Collar arc: adjustable', 'Inner curve: contoured fit'],
        bullets: [
            'Strong neckline definition for events',
            'Pairs with strapless and boat-neck outfits',
            'Designed for photo-friendly sparkle',
            'Premium event jewellery presence',
        ],
    },
    'Opera Necklaces': {
        epithets: [
            'Long Opera Strand',
            'Station Opera Chain',
            'Layer-Once Opera Length',
        ],
        audience: 'Women',
        dim: ['Length: 26 inches', 'Length: 28 inches', 'Length: 30 inches'],
        bullets: [
            'Long length for classic opera and evening drape',
            'Can be doubled for a layered choker effect',
            'Elegant movement when you walk',
            'Timeless formal wardrobe piece',
        ],
    },
    'Stud Earrings': {
        epithets: [
            'Round Solitaire Stud',
            'Floral Stud Cluster',
            'Minimal Button Stud',
            'Hex Stud Modern',
            'Pear-Shaped Stud',
        ],
        audience: 'Women',
        dim: ['Stud face: 6mm', 'Stud face: 7mm', 'Stud face: 8mm'],
        bullets: [
            'Everyday essential — sleep-friendly low profile',
            'Secure push or screw-back style (as per design)',
            'Office and college appropriate',
            'Starter earring for new piercings (consult jeweller)',
        ],
    },
    'Hoop Earrings': {
        epithets: [
            'Classic Round Hoop',
            'Huggie Hoop',
            'Textured Hoop',
            'Oval Hoop',
            'Chunky Tube Hoop',
        ],
        audience: 'Women',
        dim: ['Diameter: 18mm', 'Diameter: 22mm', 'Diameter: 28mm'],
        bullets: [
            'Instant face-framing lift',
            'From huggie subtle to bold hoop',
            'Snap or hinge closure for easy wear',
            'Pairs with ponytails and open hair',
        ],
    },
    'Drop Earrings': {
        epithets: [
            'Linear Drop',
            'Teardrop Dangle',
            'Double Drop Chain',
            'Sleek Bar Drop',
        ],
        audience: 'Women',
        dim: ['Drop length: 25mm', 'Drop length: 32mm', 'Drop length: 38mm'],
        bullets: [
            'Elongates the neck visually',
            'Great for kurtis, dresses, and saree blouses',
            'Movement catches light as you turn',
            'Evening and dinner-ready',
        ],
    },
    'Jhumka Earrings': {
        epithets: [
            'Classic Bell Jhumka',
            'Layered Tier Jhumka',
            'Temple Top Jhumka',
            'Pearl Drop Jhumka',
        ],
        audience: 'Women',
        dim: ['Jhumka length: 35mm', 'Jhumka length: 42mm', 'Jhumka length: 48mm'],
        bullets: [
            'Festive and wedding favourite',
            'Traditional silhouette with balanced weight',
            'Pairs with lehenga, saree, and anarkali',
            'Detailed lower bell for signature sound and look',
        ],
    },
    'Chandelier Earrings': {
        epithets: [
            'Tiered Chandelier',
            'Branch Chandelier',
            'Crystal-Style Chandelier',
        ],
        audience: 'Women',
        dim: ['Overall length: 55mm', 'Overall length: 62mm'],
        bullets: [
            'High-impact bridal and reception earrings',
            'Designed for updos and open shoulders',
            'Multi-level sparkle in movement',
            'Statement photography jewellery',
        ],
    },
    'Clip-On Earrings': {
        epithets: [
            'Padded Clip-On Stud',
            'Clip-On Hoop Style',
            'Clip-On Drop',
        ],
        audience: 'Women',
        dim: ['Clip pad: comfort cushioned'],
        bullets: [
            'For non-pierced ears — no compromise on style',
            'Adjustable tension where applicable',
            'Ideal for occasional festive wear',
            'Gift-friendly for all ages',
        ],
    },
    'Ear Cuffs': {
        epithets: [
            'Slim Upper Ear Cuff',
            'Double Line Cuff',
            'Climber-Style Cuff',
        ],
        audience: 'Women',
        dim: ['Cuff opening: adjustable squeeze fit'],
        bullets: [
            'No piercing required for a stacked ear look',
            'Trendy with short hair and buns',
            'Wear alone or with studs',
            'Light pressure — remove before sleep',
        ],
    },
    'Threader Earrings': {
        epithets: [
            'Chain Threader',
            'Bar Threader',
            'Double Threader',
        ],
        audience: 'Women',
        dim: ['Threader chain: delicate gauge'],
        bullets: [
            'Minimal, airy look for modern outfits',
            'Easy to thread through standard piercings',
            'Pairs with layered necklaces',
            'Delicate — store in a soft pouch',
        ],
    },
    'Dangle Earrings': {
        epithets: [
            'Single Dangle',
            'Dual Dangle',
            'Swing Dangle',
        ],
        audience: 'Women',
        dim: ['Dangle length: 28mm', 'Dangle length: 35mm'],
        bullets: [
            'Playful movement without heavy weight',
            'Day-to-evening versatile',
            'Complements round and oval face shapes',
            'Secure hook or lever back',
        ],
    },
    'Bali Earrings': {
        epithets: [
            'Classic Gold Bali',
            'Twisted Wire Bali',
            'Medium Daily Bali',
            'Bold Festive Bali',
        ],
        audience: 'Women',
        dim: ['Bali diameter: 20mm', 'Bali diameter: 25mm', 'Bali diameter: 30mm'],
        bullets: [
            'Beloved Indian hoop variant',
            'Daily wear friendly in medium sizes',
            'Larger sizes for Navratri and weddings',
            'Smooth inner edge for comfort',
        ],
    },
    'Bangle Bracelets': {
        epithets: [
            'Classic Round Bangle',
            'Half-Textured Bangle',
            'Slim Stack Bangle',
            'Wide Cuff Bangle',
        ],
        audience: 'Women',
        dim: ['Size: 2.4 (standard)', 'Size: 2.6', 'Size: 2.8', 'Inner diameter: 57mm'],
        bullets: [
            'Stack multiple for a traditional gold look',
            'Single bangle for minimal office style',
            'High polish for wrist shine',
            'Check wrist size before ordering',
        ],
    },
    'Charm Bracelets': {
        epithets: [
            'Multi-Charm Bracelet',
            'Heart Charm Line',
            'Symbolic Charm Set',
        ],
        audience: 'Women',
        dim: ['Length: 7 inches', 'Length: 7.5 inches', 'Adjustable links'],
        bullets: [
            'Storytelling piece with meaningful charms',
            'Fun gift for birthdays and graduations',
            'Secure links and clasp',
            'Layer with watch or slim bangles',
        ],
    },
    'Tennis Bracelets': {
        epithets: [
            'Continuous Line Bracelet',
            'Four-Prong Line Style',
            'Slim Tennis Row',
        ],
        audience: 'Women',
        dim: ['Length: 6.5 inches', 'Length: 7 inches'],
        bullets: [
            'Red-carpet sparkle on the wrist',
            'Even line of stones for uniform shine',
            'Secure box clasp with safety latch',
            'Anniversary and milestone gifting favourite',
        ],
    },
    'Cuff Bracelets': {
        epithets: [
            'Open Cuff Bracelet',
            'Sculpted Cuff',
            'Minimal Flat Cuff',
        ],
        audience: 'Women',
        dim: ['Opening gap: adjustable light squeeze', 'Cuff width: 8mm'],
        bullets: [
            'Bold wrist statement',
            'Easy slip-on open style',
            'Modern with western and fusion outfits',
            'Smooth inner for skin comfort',
        ],
    },
    'Kada Bracelets': {
        epithets: [
            'Plain Gold Kada',
            'Engraved Motif Kada',
            'Screw-Open Kada',
            'Heavy Wedding Kada',
        ],
        audience: 'Women',
        dim: ['Inner diameter: 58mm', 'Inner diameter: 60mm', 'Width: 6mm'],
        bullets: [
            'North Indian wedding and festive staple',
            'Pairs with choora and bangles',
            'Solid heft with premium feel',
            'Traditional gifting for brides',
        ],
    },
    'Stackable Bracelets': {
        epithets: [
            'Slim Stack Chain',
            'Bead Stack Bracelet',
            'Mixed Texture Stack Set',
        ],
        audience: 'Women',
        dim: ['Length: 6.5–7 inches adjustable'],
        bullets: [
            'Curate your wrist stack with multiples',
            'Lightweight for all-day wear',
            'Mix metals and textures on trend',
            'Great starter gift sets',
        ],
    },
    'Cuban Link Chains': {
        epithets: [
            'Bold Cuban Link',
            'Medium Cuban Chain',
            'Micro Cuban Chain',
        ],
        audience: 'Unisex',
        dim: ['Length: 20 inches', 'Length: 22 inches', 'Length: 24 inches'],
        bullets: [
            'Strong link pattern with street-luxe appeal',
            'Popular for pendants or solo wear',
            'Substantial feel with smooth edges',
            'Clasp tested for daily use',
        ],
    },
    'Rope Chains': {
        epithets: [
            'Twisted Rope Chain',
            'Diamond-Cut Rope',
            'Classic Rope Link',
        ],
        audience: 'Unisex',
        dim: ['Thickness: 2mm', 'Thickness: 2.5mm', 'Thickness: 3mm', 'Length: 20–24 inches'],
        bullets: [
            'Textured shine from twisted metal',
            'Great base chain for pendants',
            'Durable everyday chain option',
            'Works across ages and genders',
        ],
    },
    'Figaro Chains': {
        epithets: [
            'Classic Figaro Link',
            'Flat Figaro Chain',
            'Medium Figaro',
        ],
        audience: 'Unisex',
        dim: ['Length: 20 inches', 'Length: 22 inches'],
        bullets: [
            'Iconic alternating link rhythm',
            'Slim enough for layering',
            'Timeless men’s and women’s favourite',
            'Pairs with religious and initial pendants',
        ],
    },
    'Snake Chains': {
        epithets: [
            'Smooth Snake Chain',
            'Round Snake Chain',
            'Fine Snake for Pendant',
        ],
        audience: 'Unisex',
        dim: ['Thickness: 1.2mm', 'Thickness: 1.5mm', 'Length: 18–22 inches'],
        bullets: [
            'Liquid-like drape on the neck',
            'Ideal for lightweight pendants',
            'Minimalist and modern',
            'Store flat to avoid kinks',
        ],
    },
    'Bridal Necklace Sets': {
        epithets: [
            'Necklace & Earring Bridal Set',
            'Short Necklace Bridal Combo',
            'Temple Bridal Set',
        ],
        audience: 'Women',
        dim: ['Necklace + matching earrings (set)', 'Adjustable necklace length'],
        bullets: [
            'Coordinated set for hassle-free bridal styling',
            'Photography-ready sparkle under lights',
            'Matches heavy lehenga and saree drapes',
            'Keepsake after the wedding day',
        ],
    },
    'Bridal Bangles': {
        epithets: [
            'Wedding Bangle Pair',
            'Engraved Bridal Bangles',
            'Stone-Accent Bridal Set',
        ],
        audience: 'Women',
        dim: ['Set of 2 / 4 / 6 (design dependent)', 'Size: 2.4–2.8'],
        bullets: [
            'Designed for bridal choora stacks',
            'High shine for mehendi and sangeet photos',
            'Comfort inner curve for long wear',
            'Traditional symbolism with modern finish',
        ],
    },
    'Bridal Maang Tikka': {
        epithets: [
            'Single-String Maang Tikka',
            'Borla Style Tikka',
            'Layered Forehead Tikka',
        ],
        audience: 'Women',
        dim: ['Chain length to hair part: standard bridal', 'Forehead drop: adjustable hook'],
        bullets: [
            'Completes the bridal forehead frame',
            'Secure hook for different hairstyles',
            'Pairs with passa and jhumar options',
            'Lightweight options for long ceremonies',
        ],
    },
    'Bridal Earrings': {
        epithets: [
            'Bridal Chandbali',
            'Heavy Jhumka Bridal',
            'Shoulder-Duster Bridal',
        ],
        audience: 'Women',
        dim: ['Long drop: bridal proportion', 'Weight balanced for extended wear'],
        bullets: [
            'Made to stand out under mandap lighting',
            'Coordinates with bridal necklace sets',
            'Photography and video friendly scale',
            'Premium finish for the most important day',
        ],
    },
    'Bridal Full Sets': {
        epithets: [
            'Necklace, Earrings & Tikka Set',
            'Complete Bridal Jewellery Set',
            'Heritage Full Bridal Set',
        ],
        audience: 'Women',
        dim: ['Multi-piece set — see pack list on invoice'],
        bullets: [
            'One purchase for core bridal jewellery',
            'Matched design language across pieces',
            'Ideal for families planning trousseau',
            'Heirloom-quality presentation',
        ],
    },
    "Men's Rings": {
        epithets: [
            'Signet Face Ring',
            'Bold Band Ring',
            'Textured Men’s Band',
            'Black Accent Men’s Ring',
        ],
        audience: 'Men',
        dim: ['Band width: 6mm', 'Band width: 7mm', 'Band width: 8mm'],
        bullets: [
            'Masculine proportions and weight',
            'Office and casual wear suitable',
            'Strong polish or brushed finish options',
            'Popular gifting for birthdays and promotions',
        ],
    },
    "Men's Chains": {
        epithets: [
            'Bold Daily Chain',
            'Medium Weight Chain',
            'Sleek Office Chain',
        ],
        audience: 'Men',
        dim: ['Length: 20 inches', 'Length: 22 inches', 'Length: 24 inches'],
        bullets: [
            'Built for daily wear with sturdy clasp',
            'Pairs with religious and dog-tag pendants',
            'Layer-friendly with watches',
            'Timeless men’s wardrobe staple',
        ],
    },
    "Men's Bracelets": {
        epithets: [
            'Cuban Link Bracelet',
            'ID Plate Bracelet',
            'Minimal Link Bracelet',
        ],
        audience: 'Men',
        dim: ['Length: 8 inches', 'Length: 8.5 inches'],
        bullets: [
            'Rugged look with comfortable inner curve',
            'Stack with watch on opposite wrist',
            'Secure clasp for active lifestyles',
            'Gift-ready for brothers, fathers, partners',
        ],
    },
    "Men's Kadas": {
        epithets: [
            'Plain Gold Kada',
            'Engraved Sikh-Style Kada',
            'Heavy Men’s Kada',
        ],
        audience: 'Men',
        dim: ['Inner diameter: 64mm', 'Inner diameter: 66mm', 'Width: 8mm'],
        bullets: [
            'Cultural and spiritual significance for many wearers',
            'Solid wrist presence',
            'Smooth inner for daily comfort',
            'Festival and wedding favourite for men',
        ],
    },
    "Men's Pendants": {
        epithets: [
            'Religious Motif Pendant',
            'Dog-Tag Style Pendant',
            'Minimal Bar Pendant',
        ],
        audience: 'Men',
        dim: ['Bail fits standard men’s chains', 'Pendant height: 28–35mm'],
        bullets: [
            'Meaningful everyday wear at the neck',
            'Pairs with medium-weight chains',
            'Matte or high polish options',
            'Thoughtful rakhi and birthday gift',
        ],
    },
    "Men's Cufflinks": {
        epithets: [
            'Round Formal Cufflink',
            'Rectangle Engravable Cufflink',
            'Minimal Stud Cufflink',
        ],
        audience: 'Men',
        dim: ['Face: 16mm', 'Face: 18mm', 'Standard shirt cuff fit'],
        bullets: [
            'Sharp finish for suits and blazers',
            'Wedding and corporate event ready',
            'Secure toggle or bullet back',
            'Elevates shirt cuffs instantly',
        ],
    },
    'Birthday Gifts': {
        epithets: [
            'Birthday Surprise Jewellery',
            'Keepsake Birthday Gift',
            'Sweet Sixteen Style Gift',
        ],
        audience: 'Women',
        dim: ['Gift-ready packaging friendly sizes'],
        bullets: [
            'Curated to delight on their special day',
            'Versatile designs most recipients love',
            'Thoughtful unboxing experience',
            'Add a personal note at checkout',
        ],
    },
    'Anniversary Gifts': {
        epithets: [
            'Anniversary Milestone Gift',
            'Together Forever Theme',
            'Romantic Anniversary Set',
        ],
        audience: 'Women',
        dim: ['Classic proportions for gifting'],
        bullets: [
            'Marks years together with lasting gold',
            'Designs that feel personal, not generic',
            'Ideal for 1st, 5th, 10th milestones',
            'Pairs with flowers and handwritten cards',
        ],
    },
    'Wedding Gifts': {
        epithets: [
            'Wedding Blessing Gift',
            'Newlywed Keepsake',
            'Ceremony Celebration Gift',
        ],
        audience: 'Women',
        dim: ['Ceremony-appropriate scale'],
        bullets: [
            'Perfect for gifting the bride or couple',
            'Respects traditional and modern tastes',
            'Photo-friendly under wedding lights',
            'Meaningful beyond the wedding week',
        ],
    },
    'Festival Gifts': {
        epithets: [
            'Diwali Sparkle Gift',
            'Festive Gold Gift',
            'Celebration Season Jewellery',
        ],
        audience: 'Women',
        dim: ['Festival wear friendly'],
        bullets: [
            'Shines during Diwali, Eid, Navratri, and more',
            'Hosts love receiving jewellery over mithai-only',
            'Pairs with ethnic outfits in family photos',
            'Reusable every festive season',
        ],
    },
    'Valentine Gifts': {
        epithets: [
            'Heart Motif Valentine',
            'Romantic Valentine Keepsake',
            'Forever Yours Style',
        ],
        audience: 'Women',
        dim: ['Delicate to medium romantic scale'],
        bullets: [
            'Designed for February 14th surprises',
            'Sweet without feeling childish',
            'Works for new couples and long marriages',
            'Instagram-ready gift moment',
        ],
    },
    "Mother's Day Gifts": {
        epithets: [
            'Mom Forever Gift',
            'Floral Tribute Jewellery',
            'Gratitude Keepsake',
        ],
        audience: 'Women',
        dim: ['Elegant everyday to statement options'],
        bullets: [
            'Honours mothers and mother figures',
            'Comfortable for daily reminder wear',
            'Emotional value with lasting quality',
            'Sibling group gifting favourite',
        ],
    },
    'Corporate Gifts': {
        epithets: [
            'Executive Appreciation Gift',
            'Milestone Recognition Jewellery',
            'Team Celebration Piece',
        ],
        audience: 'Unisex',
        dim: ['Professional, understated sizing'],
        bullets: [
            'Appropriate for workplace recognition',
            'No overly flashy motifs',
            'Long shelf life vs consumable gifts',
            'Invoice-friendly for corporate orders',
        ],
    },
};

function pick(arr, i) {
    return arr[i % arr.length];
}

function getProfile(subcategoryname, category) {
    const p = SUBCATEGORY_COPY[subcategoryname];
    if (p) return p;
    return {
        epithets: [`${category} Collection`, `Classic ${category}`, `Designer ${category}`],
        audience: 'Women',
        dim: ['See product images for scale', 'Standard fit'],
        bullets: [
            'Quality finish and comfortable wear',
            'Versatile for multiple occasions',
            BRAND.craftsmanship,
            'Ideal for gifting',
        ],
    };
}

function buildDescription(sub, profile, material, plating, adj, epithet) {
    const cat = sub.category;
    const subn = sub.subcategoryname;
    const aud = profile.audience === 'Unisex' ? 'everyone' : profile.audience.toLowerCase();

    const p1 = `This ${adj.toLowerCase()} ${subn.toLowerCase()} — ${epithet.toLowerCase()} — is crafted in ${material} with a ${plating.toLowerCase()} finish. It is designed for ${aud} who want jewellery that feels special yet wearable.`;

    const p2 = `From our ${cat} range at ${BRAND.name}, this piece balances traditional appeal with clean, modern lines so you can dress it up for celebrations or tone it down for everyday moments.`;

    const p3 = `Each design is finished with attention to comfort, skin-friendly surfaces, and lasting shine — so it stays a favourite in your collection for years.`;

    return `${p1} ${p2} ${p3}`;
}

function buildProductDetailsFromProfile(profile, material, i) {
    const extra = pick(
        [
            `Metal tone and finish may vary slightly by lighting — refer to studio images.`,
            `Store separately to avoid scratches with harder pieces.`,
            `Avoid perfume and lotion directly on the piece after wear.`,
            `Polish gently with a soft cloth to maintain lustre.`,
        ],
        i
    );
    return [...profile.bullets.map((b) => ({ details: b })), { details: extra }];
}

function buildDetailsLine(sub, material, weight, dimLine) {
    return `${BRAND.name} ${sub.category} · ${material} · ${weight} · ${dimLine} · Nickel-conscious finishing where applicable.`;
}

function configureCloudinary() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error(
            'Missing Cloudinary env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
        );
        process.exit(1);
    }
    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET,
    });
}

function getProjectRoot() {
    if (process.env.SEED_LOCAL_ROOT && String(process.env.SEED_LOCAL_ROOT).trim()) {
        return path.resolve(process.env.SEED_LOCAL_ROOT.trim());
    }
    return path.resolve(path.join(__dirname, '..', '..'));
}

function listImageFilesInDir(absDir) {
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) return [];
    return fs
        .readdirSync(absDir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
        .sort();
}

function uploadFileToCloudinary(localPath, cloudFolder) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(
            localPath,
            {
                folder: cloudFolder,
                resource_type: 'image',
                use_filename: true,
                unique_filename: true,
                overwrite: false,
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
}

/**
 * @returns {Promise<{ url: string, category: string }[]>}
 */
async function uploadFromLocalProjectFolders() {
    const root = getProjectRoot();
    const tagged = [];
    console.log(`Scanning local image folders under: ${root}`);

    for (const { dir, category } of LOCAL_FOLDER_MAP) {
        const abs = path.join(root, dir);
        const names = listImageFilesInDir(abs);
        const cloudFolder = BRAND.cloudinaryFolder(dir);
        console.log(`  ${dir}/ → ${names.length} image file(s) → Cloudinary folder "${cloudFolder}"`);

        for (const name of names) {
            const full = path.join(abs, name);
            try {
                const res = await uploadFileToCloudinary(full, cloudFolder);
                tagged.push({ url: res.secure_url, category });
            } catch (e) {
                console.warn(`    skip ${name}: ${e.message || e}`);
            }
        }
    }

    return tagged;
}

function listResourcesPage(options) {
    return new Promise((resolve, reject) => {
        // cloudinary v2: admin API uses (options, callback), not (callback, options)
        cloudinary.api.resources(options, (err, res) => {
            if (err) return reject(err);
            resolve(res);
        });
    });
}

async function listAllInPrefix(prefix) {
    const collected = [];
    let next_cursor;
    do {
        const res = await listResourcesPage({
            type: 'upload',
            resource_type: 'image',
            prefix,
            max_results: 500,
            ...(next_cursor ? { next_cursor } : {}),
        });
        collected.push(...(res.resources || []));
        next_cursor = res.next_cursor;
    } while (next_cursor);
    return collected;
}

async function fetchAllFolderImages() {
    const byPublicId = new Map();
    for (const prefix of FOLDER_PREFIXES) {
        try {
            const resources = await listAllInPrefix(prefix);
            for (const r of resources) {
                if (r.public_id && r.secure_url) {
                    byPublicId.set(r.public_id, r.secure_url);
                }
            }
            console.log(`  ${prefix}: ${resources.length} image(s)`);
        } catch (e) {
            console.warn(`  ${prefix}: list failed — ${e.message || e}`);
        }
    }
    return [...byPublicId.values()];
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function pickExtraImages(pool, primaryUrl, count) {
    if (pool.length <= 1 || count === 0) return [];
    const others = pool.filter((u) => u !== primaryUrl);
    shuffleInPlace(others);
    return others.slice(0, Math.min(count, others.length));
}

function pricePair(seed) {
    const base = 4999 + (seed % 120) * 250;
    const original = Math.round(base * (1.15 + (seed % 10) * 0.02));
    return { price: base, originalPrice: original };
}

function buildProductName(sub, profile, adj, epithet) {
    const subn = sub.subcategoryname;
    if (subn.startsWith("Men's")) {
        return `${adj} ${epithet} — ${subn}`;
    }
    if (sub.category === 'Gifts') {
        return `${adj} ${epithet} — ${subn}`;
    }
    if (profile.audience === 'Unisex') {
        return `${adj} ${epithet} ${subn}`;
    }
    return `${adj} ${epithet} ${subn} for ${profile.audience}`;
}

function subsByCategory(subs) {
    const m = new Map();
    for (const s of subs) {
        if (!m.has(s.category)) m.set(s.category, []);
        m.get(s.category).push(s);
    }
    return m;
}

/** @param seeds  plain URL strings or { url, category } from local upload */
function buildDocs(subs, seeds) {
    const normalized = seeds.map((s) =>
        typeof s === 'string' ? { url: s, category: null } : { url: s.url, category: s.category || null }
    );
    const pool = normalized.map((n) => n.url);
    const nPool = pool.length;
    if (nPool === 0) return [];

    const byCat = subsByCategory(subs);
    const catRound = {};
    const docs = [];
    let seq = 0;

    function pushOne(sub, primary) {
        const profile = getProfile(sub.subcategoryname, sub.category);
        const extras = pickExtraImages(pool, primary, EXTRA_IMAGES);
        const images = [primary, ...extras];
        const { price, originalPrice } = pricePair(seq);
        const adj = pick(ADJECTIVES, seq);
        const epithet = pick(profile.epithets, seq);
        const material = pick(MATERIALS, seq);
        const plating = pick(PLATINGS, seq);
        const dimLine = pick(profile.dim, seq);
        const weight = pick(WEIGHTS, seq);

        const productname = buildProductName(sub, profile, adj, epithet);
        const description = buildDescription(sub, profile, material, plating, adj, epithet);
        const productdetails = buildProductDetailsFromProfile(profile, material, seq);
        const details = buildDetailsLine(sub, material, weight, dimLine);

        docs.push({
            productname,
            price,
            originalPrice,
            categoryid: sub.categoryid,
            category: sub.category,
            subcategoryid: sub._id,
            subcategory: sub.subcategoryname,
            images,
            description,
            instock: 1,
            material,
            plating,
            dimensions: dimLine,
            weight,
            details,
            productdetails,
            status: 1,
            recordinfo: {
                createby: SEED_CREATEBY,
                createat: new Date(),
            },
        });
        seq += 1;
    }

    for (const entry of normalized) {
        let list = entry.category && byCat.has(entry.category) ? byCat.get(entry.category) : null;
        if (!list || list.length === 0) list = subs;
        const key = entry.category || '__any__';
        if (catRound[key] === undefined) catRound[key] = 0;
        const sub = list[catRound[key] % list.length];
        catRound[key] += 1;
        pushOne(sub, entry.url);
    }

    const target = Math.max(MIN_PRODUCTS, nPool);
    while (docs.length < target) {
        const sub = subs[seq % subs.length];
        const primary = pool[seq % nPool];
        pushOne(sub, primary);
    }

    return docs;
}

async function insertBatches(docs, batchSize = 40) {
    let inserted = 0;
    for (let i = 0; i < docs.length; i += batchSize) {
        const slice = docs.slice(i, i + batchSize);
        try {
            const res = await ProductMaster.insertMany(slice, { ordered: false });
            inserted += res.length;
        } catch (err) {
            if (err.name === 'MongoBulkWriteError' && err.insertedDocs) {
                inserted += err.insertedDocs.length;
                const dup = err.writeErrors?.filter((e) => e.code === 11000).length || 0;
                if (dup) console.warn(`  batch ${i / batchSize + 1}: ${dup} duplicate name(s) skipped`);
            } else {
                throw err;
            }
        }
    }
    return inserted;
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI missing in backend/.env');
        process.exit(1);
    }

    configureCloudinary();

    let seeds;

    if (!process.env.SEED_SKIP_LOCAL) {
        console.log('Uploading from local project folders (if any)…');
        seeds = await uploadFromLocalProjectFolders();
    } else {
        seeds = [];
    }

    if (seeds.length === 0) {
        console.log('Fetching images from Cloudinary API (<brand>/* prefixes)…');
        const imageUrls = await fetchAllFolderImages();
        if (imageUrls.length === 0) {
            console.error(
                'No images found. Add files under project image folders (bridal, Earrings, mans, Necklaces, ring) or upload under <brand>/* in Cloudinary.'
            );
            process.exit(1);
        }
        seeds = imageUrls.map((url) => ({ url, category: null }));
        console.log(`Total from Cloudinary: ${seeds.length}`);
    } else {
        console.log(`Uploaded & tagged: ${seeds.length} image(s) → res.cloudinary.com`);
    }

    await mongoose.connect(uri);
    const subs = await SubCategoryMaster.find({ status: 1 }).lean();
    if (!subs.length) {
        console.error('No active subcategories (status: 1) in DB. Insert subcategories first.');
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log(`Active subcategories: ${subs.length}`);
    console.log(`Target products: ${Math.max(MIN_PRODUCTS, seeds.length)} (min ${MIN_PRODUCTS})`);

    const docs = buildDocs(subs, seeds);
    console.log(`Inserting ${docs.length} products…`);
    const inserted = await insertBatches(docs);
    console.log(`Inserted (approx): ${inserted}`);
    console.log('Done.');
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
