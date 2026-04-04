const { toStr, toNum, splitList, parseObjectIdList, mapRowHelpers } = require('./helpers');

const DEFS = {
    storefrontdemifinemaster: {
        cmsKey: 'demifineSection',
        read: (section = {}) => ({
            subtitle: toStr(section.subtitle),
            title: toStr(section.title),
            description: toStr(section.description),
            ctaText: toStr(section?.cta?.text),
            ctaHref: '/promo?section=demiFineJewelleryProducts',
        }),
        write: (body) => ({
            subtitle: toStr(body.subtitle),
            title: toStr(body.title),
            description: toStr(body.description),
            cta: { text: toStr(body.ctaText), href: '/promo?section=demiFineJewelleryProducts' },
        }),
    },
    storefrontdiscountbannermaster: {
        cmsKey: 'discountBanner',
        readDiscountUpTo: (section = {}) => {
            const direct = toNum(section.discountUpTo, 0);
            if (direct > 0) return direct;
            const href = toStr(section.href);
            const m = href.match(/discount=(\d{1,2})/i);
            return m ? toNum(m[1], 0) : 0;
        },
        read: (section = {}) => ({
            image: toStr(section.image),
            alt: toStr(section.alt),
            subtitle: toStr(section.subtitle),
            title: toStr(section.title),
            description: toStr(section.description),
            cta: toStr(section.cta),
            discountUpTo: DEFS.storefrontdiscountbannermaster.readDiscountUpTo(section),
        }),
        write: (body) => ({
            image: toStr(body.image),
            alt: toStr(body.alt),
            subtitle: toStr(body.subtitle),
            title: toStr(body.title),
            description: toStr(body.description),
            cta: toStr(body.cta),
            discountUpTo: Math.max(0, Math.min(99, toNum(body.discountUpTo, 0))),
        }),
    },
    storefrontshopbyrecipientmaster: {
        cmsKey: 'shopByRecipient',
        read: (section = {}) => ({
            title: toStr(section.title),
            ...mapRowHelpers.readRecipient(section, 1),
            ...mapRowHelpers.readRecipient(section, 2),
        }),
        write: (body) => ({
            title: toStr(body.title),
            recipients: [mapRowHelpers.writeRecipient(body, 1), mapRowHelpers.writeRecipient(body, 2)].filter(
                (row) => row.title || row.image || row.href
            ),
        }),
    },
    storefrontforeveryyoumaster: {
        cmsKey: 'forEveryYou',
        read: (section = {}) => ({
            title: toStr(section.title),
            description: toStr(section.description),
            ...mapRowHelpers.readOccasion(section, 1),
            ...mapRowHelpers.readOccasion(section, 2),
            ...mapRowHelpers.readOccasion(section, 3),
        }),
        write: (body) => ({
            title: toStr(body.title),
            description: toStr(body.description),
            occasions: [
                mapRowHelpers.writeOccasion(body, 1),
                mapRowHelpers.writeOccasion(body, 2),
                mapRowHelpers.writeOccasion(body, 3),
            ].filter((row) => row.title || row.subtitle || row.image || row.href),
        }),
    },
    storefrontfinegoldmaster: {
        cmsKey: 'fineGoldSection',
        read: (section = {}) => ({
            title: toStr(section.title),
            description: toStr(section.description),
            filters: Array.isArray(section.filters) ? section.filters.join('\n') : '',
            emptyStateTitle: toStr(section?.emptyState?.title),
            emptyStateDescriptionAll: toStr(section?.emptyState?.descriptionAll),
            emptyStateDescriptionFiltered: toStr(section?.emptyState?.descriptionFiltered),
        }),
        write: (body) => ({
            title: toStr(body.title),
            description: toStr(body.description),
            filters: splitList(body.filters),
            emptyState: {
                title: toStr(body.emptyStateTitle),
                descriptionAll: toStr(body.emptyStateDescriptionAll),
                descriptionFiltered: toStr(body.emptyStateDescriptionFiltered),
            },
        }),
    },
    storefrontdeservetoshinemaster: {
        cmsKey: 'deserveToShine',
        read: (section = {}) => ({
            title: toStr(section.title),
            image: toStr(section.image),
            description1: Array.isArray(section.description) ? toStr(section.description[0]) : '',
            description2: Array.isArray(section.description) ? toStr(section.description[1]) : '',
            ctaText: toStr(section?.cta?.text),
            ctaHref: toStr(section?.cta?.href),
        }),
        write: (body) => ({
            title: toStr(body.title),
            image: toStr(body.image),
            description: [toStr(body.description1), toStr(body.description2)].filter(Boolean),
            cta: { text: toStr(body.ctaText), href: toStr(body.ctaHref) },
        }),
    },
    storefrontfoundermessagemaster: {
        cmsKey: 'founderMessage',
        read: (section = {}) => ({
            title: toStr(section.title),
            quote: toStr(section.quote),
            description: toStr(section.description),
            name: toStr(section.name),
            role: toStr(section.role),
            image: toStr(section.image),
            alt: toStr(section.alt),
        }),
        write: (body) => ({
            title: toStr(body.title),
            quote: toStr(body.quote),
            description: toStr(body.description),
            name: toStr(body.name),
            role: toStr(body.role),
            image: toStr(body.image),
            alt: toStr(body.alt),
        }),
    },
    storefrontblogsectionmaster: {
        cmsKey: 'blogSection',
        read: (section = {}) => ({
            title: toStr(section.title),
            ...mapRowHelpers.readPost(section, 1),
            ...mapRowHelpers.readPost(section, 2),
            ...mapRowHelpers.readPost(section, 3),
            buttonText: toStr(section?.button?.text),
            buttonHref: toStr(section?.button?.href),
        }),
        write: (body) => ({
            title: toStr(body.title),
            posts: [mapRowHelpers.writePost(body, 1), mapRowHelpers.writePost(body, 2), mapRowHelpers.writePost(body, 3)].filter(
                (row) => row.slug || row.title || row.excerpt || row.image || row.dateLabel || row.href
            ),
            button: { text: toStr(body.buttonText), href: toStr(body.buttonHref) },
        }),
    },
    storefrontshopwithconfidencemaster: {
        cmsKey: 'shopWithConfidence',
        read: (section = {}) => ({
            title: toStr(section.title),
            ...mapRowHelpers.readFeature(section, 1),
            ...mapRowHelpers.readFeature(section, 2),
            ...mapRowHelpers.readFeature(section, 3),
            ...mapRowHelpers.readFeature(section, 4),
        }),
        write: (body) => ({
            title: toStr(body.title),
            features: [
                mapRowHelpers.writeFeature(body, 1),
                mapRowHelpers.writeFeature(body, 2),
                mapRowHelpers.writeFeature(body, 3),
                mapRowHelpers.writeFeature(body, 4),
            ]
                .filter((row) => row.title || row.description || row.freeShippingThresholdInr)
                .map((row) => {
                    const next = { title: row.title, description: row.description };
                    if (row.freeShippingThresholdInr) next.freeShippingThresholdInr = row.freeShippingThresholdInr;
                    return next;
                }),
        }),
    },
    storefrontbrandstorymaster: {
        cmsKey: 'brandStory',
        read: (section = {}) => ({
            title: toStr(section.title),
            image: toStr(section.image),
            alt: toStr(section.alt),
            description1: Array.isArray(section.description) ? toStr(section.description[0]) : '',
            description2: Array.isArray(section.description) ? toStr(section.description[1]) : '',
            description3: Array.isArray(section.description) ? toStr(section.description[2]) : '',
            ctaText: toStr(section?.cta?.text),
            ctaHref: toStr(section?.cta?.href),
        }),
        write: (body) => ({
            title: toStr(body.title),
            image: toStr(body.image),
            alt: toStr(body.alt),
            description: [toStr(body.description1), toStr(body.description2), toStr(body.description3)].filter(Boolean),
            cta: { text: toStr(body.ctaText), href: toStr(body.ctaHref) },
        }),
    },
    storefrontreviewsmaster: {
        cmsKey: 'reviews',
        read: (section = {}) => ({
            title: toStr(section.title),
            subtitle: toStr(section.subtitle),
            ...mapRowHelpers.readReview(section, 1),
            ...mapRowHelpers.readReview(section, 2),
            ...mapRowHelpers.readReview(section, 3),
        }),
        write: (body) => ({
            title: toStr(body.title),
            subtitle: toStr(body.subtitle),
            reviews: [
                mapRowHelpers.writeReview(body, 1),
                mapRowHelpers.writeReview(body, 2),
                mapRowHelpers.writeReview(body, 3),
            ].filter((row) => row.id || row.name || row.location || row.text || row.product),
        }),
    },
    storefrontctabannermaster: {
        cmsKey: 'ctaBanner',
        read: (section = {}) => ({
            title: toStr(section.title),
            description: toStr(section.description),
            ctaText: toStr(section?.cta?.text),
            ctaHref: toStr(section?.cta?.href),
        }),
        write: (body) => ({
            title: toStr(body.title),
            description: toStr(body.description),
            cta: { text: toStr(body.ctaText), href: toStr(body.ctaHref) },
        }),
    },
    storefrontvisitstoresmaster: {
        cmsKey: 'visitStores',
        read: (section = {}) => ({
            title: toStr(section.title),
            subtitle: toStr(section.subtitle),
            ...mapRowHelpers.readStore(section, 1),
            ...mapRowHelpers.readStore(section, 2),
            buttonText: toStr(section?.button?.text),
            buttonHref: toStr(section?.button?.href),
        }),
        write: (body) => ({
            title: toStr(body.title),
            subtitle: toStr(body.subtitle),
            stores: [mapRowHelpers.writeStore(body, 1), mapRowHelpers.writeStore(body, 2)].filter(
                (row) => row.name || row.city || row.address || row.image || row.href
            ),
            button: { text: toStr(body.buttonText), href: toStr(body.buttonHref) },
        }),
    },
};

function getDef(alias) {
    return DEFS[alias] || null;
}

module.exports = { DEFS, getDef };
