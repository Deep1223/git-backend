const mongoose = require('mongoose');

const shopFooterLinkSchema = new mongoose.Schema(
    {
        categoryid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CategoryMaster',
        },
        category: { type: String, trim: true, default: '' },
        linklabel: { type: String, trim: true, default: '' },
        linkhref: { type: String, trim: true, default: '' },
    },
    { _id: false }
);

const heroSlideSchema = new mongoose.Schema(
    {
        image: { type: String, trim: true, default: '' },
        title: { type: String, trim: true, default: '' },
        subtitle: { type: String, trim: true, default: '' },
        caption: { type: String, trim: true, default: '' },
        cta: { type: String, trim: true, default: '' },
        href: { type: String, trim: true, default: '' },
    },
    { _id: false }
);

const generalSettingSchema = new mongoose.Schema({
    storeName: { type: String, trim: true, default: 'ORINKET' },
    storeDescription: { type: String, trim: true, default: '' },
    metaTitle: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    metaKeywords: { type: String, trim: true, default: '' },

    storeEmail: { type: String, trim: true, default: '' },
    storePhone: { type: String, trim: true, default: '' },
    storeAddress: { type: String, trim: true, default: '' },
    supportHours: { type: String, trim: true, default: '' },

    /** ISO 4217 code — synced from Country Master when defaultCountryid is set. */
    defaultCurrency: { type: String, trim: true, default: 'INR' },
    defaultCountryid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CountryMaster',
        default: null,
    },
    /** Applied when defaultCurrency is not INR (percentage markup on displayed prices). */
    otherCurrencyPriceIncreasePercent: { type: Number, default: 0 },
    timezone: { type: String, trim: true, default: 'Asia/Kolkata' },
    taxRate: { type: Number, default: 0 },

    topBannerDesktopText: { type: String, trim: true, default: '' },
    topBannerMobileText: { type: String, trim: true, default: '' },
    secondaryBannerText: { type: String, trim: true, default: '' },
    showTopBanner: { type: Number, default: 1 },
    showSecondaryBanner: { type: Number, default: 1 },

    brandName: { type: String, trim: true, default: 'ORINKET' },
    brandDescription: { type: String, trim: true, default: '' },
    footerLogoUrl: { type: String, trim: true, default: '' },

    newsletterTitle: { type: String, trim: true, default: '' },
    newsletterDescription: { type: String, trim: true, default: '' },
    newsletterPlaceholder: { type: String, trim: true, default: 'Your email' },
    newsletterButtonText: { type: String, trim: true, default: 'SUBSCRIBE' },
    newsletterEnabled: { type: Number, default: 1 },

    shopFooterLinks: { type: [shopFooterLinkSchema], default: [] },

    /** Static company footer URLs (labels fixed in storefront). */
    urlCompanyAbout: { type: String, trim: true, default: '/about' },
    urlCompanyStory: { type: String, trim: true, default: '/story' },
    urlCompanyStores: { type: String, trim: true, default: '/stores' },
    urlCompanyBlog: { type: String, trim: true, default: '/blog' },
    urlCompanyCareers: { type: String, trim: true, default: '/careers' },

    urlSupportContact: { type: String, trim: true, default: '/contact' },
    urlSupportFaq: { type: String, trim: true, default: '/faq' },
    urlSupportShipping: { type: String, trim: true, default: '/shipping' },
    urlSupportReturns: { type: String, trim: true, default: '/returns' },
    urlSupportTrack: { type: String, trim: true, default: '/track' },

    urlLegalPrivacy: { type: String, trim: true, default: '/privacy' },
    urlLegalTerms: { type: String, trim: true, default: '/terms' },
    urlLegalRefund: { type: String, trim: true, default: '/refund' },

    instagramUrl: { type: String, trim: true, default: '' },
    facebookUrl: { type: String, trim: true, default: '' },
    twitterUrl: { type: String, trim: true, default: '' },
    youtubeUrl: { type: String, trim: true, default: '' },

    paymentVisa: { type: Number, default: 1 },
    paymentMastercard: { type: Number, default: 1 },
    paymentUpi: { type: Number, default: 1 },
    paymentPaytm: { type: Number, default: 1 },

    seoHomepageTitle: { type: String, trim: true, default: '' },
    seoHomepageMetaDescription: { type: String, trim: true, default: '' },

    /** Homepage hero — Dashboard → Storefront homepage (or legacy API field) */
    heroSlides: { type: [heroSlideSchema], default: [] },
    /**
     * Optional JSON for extra homepage & policy copy (see dashboard field help text).
     * Example top-level keys: demifineSection, topStylesSection, supportPages, termsPage, privacyPage, …
     */
    storefrontContentJson: { type: String, default: '' },

    recordinfo: {
        createat: { type: Date, default: Date.now },
        createby: { type: String },
        updateat: { type: Date },
        updateby: { type: String },
    },
});

generalSettingSchema.pre('save', function () {
    if (this.isNew) {
        if (!this.recordinfo) this.recordinfo = {};
        this.recordinfo.updateat = undefined;
        this.recordinfo.updateby = undefined;
    }
});

module.exports = mongoose.model('GeneralSetting', generalSettingSchema);
