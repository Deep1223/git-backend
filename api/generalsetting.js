const mongoose = require('mongoose');
const GeneralSetting = require('../modal/generalsetting');
const CountryMaster = require('../modal/countrymaster');

async function syncDefaultCurrencyFromCountry(body) {
    const b = body && typeof body === 'object' ? { ...body } : {};
    if (b.defaultCountryid && mongoose.Types.ObjectId.isValid(b.defaultCountryid)) {
        const c = await CountryMaster.findById(b.defaultCountryid).select('currencycode').lean();
        if (c?.currencycode) {
            b.defaultCurrency = String(c.currencycode).trim().toUpperCase();
        }
    }
    return b;
}

async function enrichGeneralSettingWithDefaultCountry(o) {
    if (!o || o.defaultCountryid) return o;
    const cur = o.defaultCurrency ? String(o.defaultCurrency).trim() : '';
    if (!cur) return o;
    const esc = cur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const c = await CountryMaster.findOne({
        status: 1,
        currencycode: new RegExp(`^${esc}$`, 'i'),
    })
        .select('_id')
        .lean();
    if (c?._id) {
        o.defaultCountryid = c._id;
    }
    return o;
}

const STRING_SORT_FIELDS = [
    'storeName',
    'defaultCurrency',
    'storeEmail',
    'timezone',
    'metaTitle',
    'brandName',
    'seoHomepageTitle',
    'urlCompanyAbout',
    'urlCompanyStory',
    'urlCompanyStores',
    'urlCompanyBlog',
    'urlCompanyCareers',
    'urlSupportContact',
    'urlSupportFaq',
    'urlSupportShipping',
    'urlSupportReturns',
    'urlSupportTrack',
    'urlLegalPrivacy',
    'urlLegalTerms',
    'urlLegalRefund',
];

const SEARCH_TEXT_FIELDS = [
    'storeName',
    'storeDescription',
    'metaTitle',
    'metaDescription',
    'metaKeywords',
    'storeEmail',
    'storePhone',
    'storeAddress',
    'supportHours',
    'defaultCurrency',
    'timezone',
    'brandName',
    'brandDescription',
    'topBannerDesktopText',
    'topBannerMobileText',
    'secondaryBannerText',
    'seoHomepageTitle',
    'seoHomepageMetaDescription',
    'instagramUrl',
    'facebookUrl',
    'twitterUrl',
    'youtubeUrl',
    'pinterestUrl',
    'urlCompanyAbout',
    'urlCompanyStory',
    'urlCompanyStores',
    'urlCompanyBlog',
    'urlCompanyCareers',
    'urlSupportContact',
    'urlSupportFaq',
    'urlSupportShipping',
    'urlSupportReturns',
    'urlSupportTrack',
    'urlLegalPrivacy',
    'urlLegalTerms',
    'urlLegalRefund',
];

const URL_TRIM_FIELDS = [
    'urlCompanyAbout',
    'urlCompanyStory',
    'urlCompanyStores',
    'urlCompanyBlog',
    'urlCompanyCareers',
    'urlSupportContact',
    'urlSupportFaq',
    'urlSupportShipping',
    'urlSupportReturns',
    'urlSupportTrack',
    'urlLegalPrivacy',
    'urlLegalTerms',
    'urlLegalRefund',
];

function toNum(v, fallback = 0) {
    if (v === undefined || v === null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toFloat(v, fallback = 0) {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}

function to01(v) {
    if (v === true || v === 1 || v === '1') return 1;
    return 0;
}

function transformDocForDashboard(doc) {
    if (!doc) return doc;
    return doc.toObject ? doc.toObject() : { ...doc };
}

function normalizeBody(body) {
    const b = body && typeof body === 'object' ? { ...body } : {};

    b.taxRate = toFloat(b.taxRate, 0);
    b.otherCurrencyPriceIncreasePercent = toFloat(b.otherCurrencyPriceIncreasePercent, 0);
    let spinFreq = Math.floor(toNum(b.spin_popup_frequency_days, 1));
    if (!Number.isFinite(spinFreq) || spinFreq < 1) spinFreq = 1;
    b.spin_popup_frequency_days = spinFreq;
    b.showTopBanner = to01(b.showTopBanner);
    b.showSecondaryBanner = to01(b.showSecondaryBanner);
    b.newsletterEnabled = to01(b.newsletterEnabled);
    b.paymentVisa = to01(b.paymentVisa);
    b.paymentMastercard = to01(b.paymentMastercard);
    b.paymentUpi = to01(b.paymentUpi);
    b.paymentPaytm = to01(b.paymentPaytm);

    if (b.defaultCurrency && typeof b.defaultCurrency === 'string') {
        b.defaultCurrency = b.defaultCurrency.trim().toUpperCase();
    }

    delete b.companyFooterLinks;
    delete b.supportFooterLinks;
    delete b.legalFooterLinks;

    if (!Array.isArray(b.shopFooterLinks)) b.shopFooterLinks = [];

    if (Array.isArray(b.shopFooterLinks)) {
        b.shopFooterLinks = b.shopFooterLinks.map((row) => {
            const r = row && typeof row === 'object' ? { ...row } : {};
            let cid = r.categoryid;
            if (cid && typeof cid === 'string' && mongoose.Types.ObjectId.isValid(cid)) {
                cid = new mongoose.Types.ObjectId(cid);
            }
            return {
                categoryid: cid || undefined,
                category: r.category != null ? String(r.category) : '',
                linklabel: r.linklabel != null ? String(r.linklabel).trim() : '',
                linkhref: r.linkhref != null ? String(r.linkhref).trim() : '',
            };
        });
    }

    if (!Array.isArray(b.heroSlides)) b.heroSlides = [];
    b.heroSlides = b.heroSlides.map((row) => {
        const r = row && typeof row === 'object' ? { ...row } : {};
        const bogo =
            r.buyOneGetOneFree === true ||
            r.buyOneGetOneFree === 1 ||
            r.buyOneGetOneFree === '1' ||
            String(r.buyOneGetOneFree || '').toLowerCase() === 'true';
        let disc = Number(r.discountUpTo);
        if (!Number.isFinite(disc)) disc = 0;
        disc = Math.floor(disc);
        if (disc < 0) disc = 0;
        if (disc > 99) disc = 99;
        return {
            image: r.image != null ? String(r.image).trim() : '',
            title: r.title != null ? String(r.title).trim() : '',
            subtitle: r.subtitle != null ? String(r.subtitle).trim() : '',
            caption: r.caption != null ? String(r.caption).trim() : '',
            cta: r.cta != null ? String(r.cta).trim() : '',
            href: r.href != null ? String(r.href).trim() : '',
            buyOneGetOneFree: Boolean(bogo),
            discountUpTo: disc,
        };
    });

    if (b.storefrontContentJson !== undefined && b.storefrontContentJson !== null) {
        b.storefrontContentJson = String(b.storefrontContentJson);
    }

    URL_TRIM_FIELDS.forEach((k) => {
        if (b[k] !== undefined && b[k] !== null) {
            b[k] = String(b[k]).trim();
        }
    });

    if (b.defaultCountryid !== undefined && b.defaultCountryid !== null && b.defaultCountryid !== '') {
        if (mongoose.Types.ObjectId.isValid(b.defaultCountryid)) {
            b.defaultCountryid = new mongoose.Types.ObjectId(b.defaultCountryid);
        } else {
            delete b.defaultCountryid;
        }
    } else {
        b.defaultCountryid = null;
    }

    return b;
}

function resolveSort(paginationinfo) {
    const incomingSort = paginationinfo?.sort || {};
    let resolvedSortField = 'recordinfo.createat';
    let resolvedSortOrder = -1;

    if (incomingSort?.field) {
        const fieldFromRequest =
            incomingSort.field === 'createdAt'
                ? 'recordinfo.createat'
                : incomingSort.field === 'updatedAt'
                  ? 'recordinfo.updateat'
                  : incomingSort.field;
        const orderFromRequest = Number(incomingSort.order);

        if (fieldFromRequest && (orderFromRequest === 1 || orderFromRequest === -1)) {
            resolvedSortField = fieldFromRequest;
            resolvedSortOrder = orderFromRequest;
        }
    } else {
        const sortEntries = Object.entries(incomingSort);
        if (sortEntries.length > 0) {
            const [rawField, rawOrder] = sortEntries[0];
            const mappedField =
                rawField === 'createdAt'
                    ? 'recordinfo.createat'
                    : rawField === 'updatedAt'
                      ? 'recordinfo.updateat'
                      : rawField;
            const mappedOrder = Number(rawOrder);

            if (mappedField && (mappedOrder === 1 || mappedOrder === -1)) {
                resolvedSortField = mappedField;
                resolvedSortOrder = mappedOrder;
            }
        }
    }

    return {
        resolvedSortField,
        resolvedSortOrder,
        sort: { [resolvedSortField]: resolvedSortOrder },
    };
}

exports.getAllGeneralSettings = async (req, res) => {
    try {
        const { paginationinfo, searchtext } = req.body || {};
        let filter = paginationinfo?.filter || {};
        const projection = paginationinfo?.projection || {};
        const hasProjection = Object.keys(projection).length > 0;

        if (searchtext) {
            filter.$or = SEARCH_TEXT_FIELDS.map((field) => ({
                [field]: { $regex: searchtext, $options: 'i' },
            }));
        }

        const { resolvedSortField, resolvedSortOrder, sort } = resolveSort(paginationinfo);
        const page = paginationinfo?.pageno || 1;
        const limit = paginationinfo?.pagelimit || 20;
        const skip = (page - 1) * limit;
        const collation = { locale: 'en', numericOrdering: true, strength: 2 };

        let rows = [];
        const useStringSort = STRING_SORT_FIELDS.includes(resolvedSortField);

        if (useStringSort) {
            const nameOrder = resolvedSortOrder === -1 ? -1 : 1;
            const pipeline = [
                { $match: filter },
                {
                    $addFields: {
                        __sortKey: { $toLower: { $ifNull: [`$${resolvedSortField}`, ''] } },
                    },
                },
                { $sort: { __sortKey: nameOrder, _id: 1 } },
                { $skip: skip },
                { $limit: limit },
                { $unset: ['__sortKey'] },
            ];
            if (hasProjection) pipeline.push({ $project: projection });
            rows = await GeneralSetting.aggregate(pipeline).collation(collation);
        } else {
            rows = await GeneralSetting.find(filter, hasProjection ? projection : undefined)
                .collation(collation)
                .sort(sort)
                .skip(skip)
                .limit(limit);
        }

        const data = await Promise.all(
            rows.map(async (r) => {
                let t = transformDocForDashboard(r);
                t = await enrichGeneralSettingWithDefaultCountry(t);
                return t;
            })
        );

        const totalCount = await GeneralSetting.countDocuments(filter);

        res.status(200).json({
            success: true,
            totalCount,
            totalcount: totalCount,
            hasNextPage: page * limit < totalCount,
            data,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.getGeneralSettingById = async (req, res) => {
    try {
        const doc = await GeneralSetting.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({
                success: false,
                message: 'General setting not found',
            });
        }
        let out = transformDocForDashboard(doc);
        out = await enrichGeneralSettingWithDefaultCountry(out);
        res.status(200).json({
            success: true,
            data: out,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.createGeneralSetting = async (req, res) => {
    try {
        let payload = normalizeBody(req.body);
        payload = await syncDefaultCurrencyFromCountry(payload);
        payload.recordinfo = {
            createby: req.user ? req.user.username : 'system',
        };

        const doc = await GeneralSetting.create(payload);
        let out = transformDocForDashboard(doc);
        out = await enrichGeneralSettingWithDefaultCountry(out);
        res.status(200).json({
            success: true,
            data: out,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateGeneralSetting = async (req, res) => {
    try {
        const id = req.body._id || req.params.id;
        let doc = await GeneralSetting.findById(id);

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: 'General setting not found',
            });
        }

        let payload = normalizeBody(req.body);
        payload = await syncDefaultCurrencyFromCountry(payload);
        delete payload._id;

        if (!payload.recordinfo) payload.recordinfo = {};
        payload.recordinfo.updateby = req.user ? req.user.username : 'system';
        payload.recordinfo.updateat = Date.now();

        doc = await GeneralSetting.findByIdAndUpdate(
            id,
            {
                $set: payload,
                $unset: {
                    companyFooterLinks: '',
                    supportFooterLinks: '',
                    legalFooterLinks: '',
                },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        let out = transformDocForDashboard(doc);
        out = await enrichGeneralSettingWithDefaultCountry(out);
        res.status(200).json({
            success: true,
            data: out,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.deleteGeneralSetting = async (req, res) => {
    try {
        const idData = req.body._id || req.params.id;

        if (!idData) {
            return res.status(400).json({ success: false, message: 'No delete data provided' });
        }

        if (typeof idData === 'object' && !Array.isArray(idData)) {
            const { bulkactionids, selectall, paginationinfo, searchtext } = idData;

            let filter = paginationinfo?.filter || {};
            if (selectall) {
                if (searchtext) {
                    filter.$or = [
                        { storeName: { $regex: searchtext, $options: 'i' } },
                        { defaultCurrency: { $regex: searchtext, $options: 'i' } },
                    ];
                }

                const query = {
                    $and: [
                        {
                            $or: [filter, { _id: { $in: bulkactionids || [] } }],
                        },
                    ],
                };

                await GeneralSetting.deleteMany(query);
            } else {
                if (bulkactionids && bulkactionids.length > 0) {
                    await GeneralSetting.deleteMany({
                        _id: { $in: bulkactionids },
                    });
                } else {
                    return res.status(400).json({ success: false, message: 'No records selected to delete' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Selected records removed',
            });
        }

        const idsToDelete = Array.isArray(idData) ? idData : [idData];
        await GeneralSetting.deleteMany({
            _id: { $in: idsToDelete },
        });

        res.status(200).json({
            success: true,
            message: 'Record removed',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};
