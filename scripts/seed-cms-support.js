/**
 * Seed storefront CMS collections + sidebar menus (MenuMaster + MenuAssignMaster).
 * Run: node scripts/seed-cms-support.js   (from backend/, with MONGO_URI in .env)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv-vault');

dotenv.config();

const CmsContactPage = require('../modal/cmsContactPage');
const CmsFaqEntry = require('../modal/cmsFaqEntry');
const CmsShippingPage = require('../modal/cmsShippingPage');
const CmsReturnsPage = require('../modal/cmsReturnsPage');
const MenuMaster = require('../modal/menumaster');
const MenuAssignMaster = require('../modal/menuassignmaster');

const MENU_ROWS = [
    { menuname: 'Contact page', pagename: 'Contact page', aliasname: 'cmscontact', icon: 'fi fi-rr-envelope' },
    { menuname: 'FAQ Master', pagename: 'FAQ Master', aliasname: 'cmsfaq', icon: 'fi fi-rr-interrogation' },
    { menuname: 'Shipping page', pagename: 'Shipping page', aliasname: 'cmsshipping', icon: 'fi fi-rr-truck-side' },
    { menuname: 'Returns & exchanges', pagename: 'Returns & exchanges', aliasname: 'cmsreturns', icon: 'fi fi-rr-rotate-right' },
];

async function seedMenus() {
    const generalMenu = await MenuMaster.findOne({ aliasname: 'generalsetting' });
    let moduleId = null;
    if (generalMenu) {
        const assign = await MenuAssignMaster.findOne({ menuid: generalMenu._id });
        if (assign) moduleId = assign.moduleid;
    }
    if (!moduleId) {
        const ModuleMaster = require('../modal/modulemaster');
        const mod = await ModuleMaster.findOne({ status: 1 }).sort({ 'recordinfo.createat': 1 });
        if (!mod) {
            console.warn('[seed-cms-support] No module found; skip menu assign. Add menus manually.');
            return;
        }
        moduleId = mod._id;
    }

    for (const row of MENU_ROWS) {
        let menu = await MenuMaster.findOne({ aliasname: row.aliasname });
        if (!menu) {
            menu = await MenuMaster.create({
                ...row,
                status: 1,
                recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
            });
            console.log('[seed-cms-support] created MenuMaster', row.aliasname);
        }
        const existingAssign = await MenuAssignMaster.findOne({ menuid: menu._id });
        if (!existingAssign) {
            await MenuAssignMaster.create({
                moduleid: moduleId,
                menuid: menu._id,
                status: 1,
                recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
            });
            console.log('[seed-cms-support] assigned menu', row.aliasname, '→ module', String(moduleId));
        }
    }
}

async function seedCmsData() {
    const contactExists = await CmsContactPage.exists({ singletonKey: 'main' });
    if (!contactExists) {
        await CmsContactPage.create({
            singletonKey: 'main',
            pageTitle: 'Contact ORINKET',
            subtitle:
                'Concierge support for orders, gifting, and styling. Manage this copy in Dashboard → Contact page.',
            email: 'care@orinket.com',
            phone: '98765 43210',
            address: '12, Jewel Square, Mumbai, India',
            hours: '24 X 7',
            hoursNote: 'For faster help, mention your order number (if available) in your message.',
            recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
        });
        console.log('[seed-cms-support] seeded CmsContactPage');
    }

    const faqCount = await CmsFaqEntry.countDocuments();
    if (faqCount === 0) {
        await CmsFaqEntry.insertMany([
            {
                groupTitle: 'Orders',
                question: 'How long does delivery take?',
                answer: 'Most metro orders arrive within 3–5 business days. You will receive tracking once shipped.',
                sortOrder: 1,
                status: 1,
                recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
            },
            {
                groupTitle: 'Orders',
                question: 'Can I change my shipping address?',
                answer: 'Contact us as soon as possible. Once dispatched, address changes may not be possible.',
                sortOrder: 2,
                status: 1,
                recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
            },
            {
                groupTitle: 'Jewellery care',
                question: 'How do I clean gold-plated jewellery?',
                answer: 'Use a soft cloth; avoid harsh chemicals and water exposure to preserve plating.',
                sortOrder: 10,
                status: 1,
                recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
            },
        ]);
        console.log('[seed-cms-support] seeded CmsFaqEntry samples');
    }

    const shipExists = await CmsShippingPage.exists({ singletonKey: 'main' });
    if (!shipExists) {
        await CmsShippingPage.create({
            singletonKey: 'main',
            title: 'Shipping information',
            subtitle: 'Transparent timelines and careful packaging for every order.',
            packaging: 'Each piece is packed in a soft pouch inside a rigid gift-ready box.',
            zones: [
                { name: 'Metro cities', eta: '3–5 business days', note: 'After dispatch' },
                { name: 'Rest of India', eta: '5–8 business days', note: 'Remote areas may take longer' },
            ],
            bullets: [
                'Free standard shipping on eligible orders.',
                'Track your order from your account once shipped.',
                'Questions? Email care@orinket.com with your order ID.',
            ],
            recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
        });
        console.log('[seed-cms-support] seeded CmsShippingPage');
    }

    const retExists = await CmsReturnsPage.exists({ singletonKey: 'main' });
    if (!retExists) {
        await CmsReturnsPage.create({
            singletonKey: 'main',
            title: 'Returns & exchanges',
            subtitle: 'We want you to love your Orinket pieces.',
            eligible: [
                'Unused items in original packaging within the return window.',
                'Manufacturing defects — we will repair or replace where applicable.',
            ],
            notEligible: [
                'Earrings (hygiene) unless defective.',
                'Items marked final sale or customised.',
            ],
            howTo: [
                'Email care@orinket.com with your order number and photos (if defective).',
                'Our team will share return instructions and the next steps.',
            ],
            supportNote: 'Questions? care@orinket.com',
            refundPolicyUrl: '/legal/refund',
            recordinfo: { createby: 'seed-cms-support', createat: Date.now() },
        });
        console.log('[seed-cms-support] seeded CmsReturnsPage');
    }
}

async function main() {
    const mongo = process.env.MONGO_URI || 'mongodb://localhost:27017/common-project';
    await mongoose.connect(mongo);
    console.log('[seed-cms-support] connected');
    await seedCmsData();
    await seedMenus();
    await mongoose.disconnect();
    console.log('[seed-cms-support] done');
}

main().catch(async (e) => {
    console.error('[seed-cms-support] failed:', e);
    await mongoose.disconnect();
    process.exit(1);
});
