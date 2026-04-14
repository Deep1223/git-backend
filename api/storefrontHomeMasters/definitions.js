const { toStr, toNum, splitList, parseObjectIdList, mapRowHelpers } = require('./helpers');

function toBool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    const raw = toStr(value).toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function toIsoDate(value) {
    const raw = toStr(value);
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
}

function toFeatureRow(row) {
    const title = toStr(row?.featureTitle ?? row?.title);
    const description = toStr(row?.featureDescription ?? row?.description);
    const threshold = toNum(row?.featureThreshold ?? row?.freeShippingThresholdInr, 0);
    const next = { title, description };
    if (threshold > 0) next.freeShippingThresholdInr = threshold;
    return next;
}

function readFeatures(section = {}) {
    const source = Array.isArray(section.features) ? section.features : [];
    return source
        .map((row) => ({
            featureTitle: toStr(row?.title),
            featureDescription: toStr(row?.description),
            featureThreshold: row?.freeShippingThresholdInr ?? '',
        }))
        .filter((row) => row.featureTitle || row.featureDescription || row.featureThreshold);
}

function writeFeatures(body = {}) {
    const rows = Array.isArray(body.features)
        ? body.features
        : [1, 2, 3, 4].map((index) => mapRowHelpers.writeFeature(body, index));
    return rows
        .map((row) => toFeatureRow(row))
        .filter((row) => row.title || row.description || row.freeShippingThresholdInr);
}

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
            eyebrow: toStr(section.eyebrow),
            title: toStr(section.title),
            description: toStr(section.description),
            ornament: toStr(section.ornament),
        }),
        write: (body) => ({
            eyebrow: toStr(body.eyebrow),
            title: toStr(body.title),
            description: toStr(body.description),
            ornament: toStr(body.ornament),
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
            slug: toStr(section.slug),
            shortDescription: toStr(section.shortDescription),
            fullContent: toStr(section.fullContent),
            featuredImage: toStr(section.featuredImage),
            imageAltText: toStr(section.imageAltText),
            category: toStr(section.category),
            subCategory: toStr(section.subCategory),
            tags: Array.isArray(section.tags) ? section.tags.map((tag) => toStr(tag)).filter(Boolean) : [],
            authorName: toStr(section.authorName),
            authorImage: toStr(section.authorImage),
            sourceReference: toStr(section.sourceReference),
            status: toStr(section.status, 'draft'),
            publishDate: toIsoDate(section.publishDate),
            scheduleDate: toIsoDate(section.scheduleDate),
            isFeatured: toBool(section.isFeatured, false),
            isTrending: toBool(section.isTrending, false),
            metaTitle: toStr(section.metaTitle),
            metaDescription: toStr(section.metaDescription),
            metaKeywords: Array.isArray(section.metaKeywords) ? section.metaKeywords.map((keyword) => toStr(keyword)).filter(Boolean) : [],
            canonicalUrl: toStr(section.canonicalUrl),
            ogTitle: toStr(section.ogTitle),
            ogDescription: toStr(section.ogDescription),
            ogImage: toStr(section.ogImage),
            twitterCardTitle: toStr(section.twitterCardTitle),
            twitterCardImage: toStr(section.twitterCardImage),
            robots: toStr(section.robots, 'index'),
            sitemapInclude: toBool(section.sitemapInclude, true),
            tableOfContents: Array.isArray(section.tableOfContents) ? section.tableOfContents : [],
            readingTime: toStr(section.readingTime),
            viewsCount: toNum(section.viewsCount, 0),
            likesCount: toNum(section.likesCount, 0),
            sharesCount: toNum(section.sharesCount, 0),
            commentsEnabled: toBool(section.commentsEnabled, true),
            adSlot1: toStr(section.adSlot1),
            adSlot2: toStr(section.adSlot2),
            adSlot3: toStr(section.adSlot3),
            affiliateLinks: Array.isArray(section.affiliateLinks) ? section.affiliateLinks.map((link) => toStr(link)).filter(Boolean) : [],
            galleryImages: Array.isArray(section.galleryImages) ? section.galleryImages.map((image) => toStr(image)).filter(Boolean) : [],
            videoUrl: toStr(section.videoUrl),
            embedCode: toStr(section.embedCode),
            articleType: toStr(section.articleType, 'BlogPosting'),
            publishedDate: toIsoDate(section.publishedDate),
            modifiedDate: toIsoDate(section.modifiedDate),
            authorSchema: toStr(section.authorSchema),
        }),
        write: (body) => ({
            title: toStr(body.title),
            slug: toStr(body.slug),
            shortDescription: toStr(body.shortDescription),
            fullContent: toStr(body.fullContent),
            featuredImage: toStr(body.featuredImage),
            imageAltText: toStr(body.imageAltText),
            category: toStr(body.category),
            subCategory: toStr(body.subCategory),
            tags: Array.isArray(body.tags) ? body.tags.map((tag) => toStr(tag)).filter(Boolean) : splitList(body.tags),
            authorName: toStr(body.authorName),
            authorImage: toStr(body.authorImage),
            sourceReference: toStr(body.sourceReference),
            status: toStr(body.status, 'draft'),
            publishDate: toIsoDate(body.publishDate),
            scheduleDate: toIsoDate(body.scheduleDate),
            isFeatured: toBool(body.isFeatured, false),
            isTrending: toBool(body.isTrending, false),
            metaTitle: toStr(body.metaTitle),
            metaDescription: toStr(body.metaDescription),
            metaKeywords: Array.isArray(body.metaKeywords) ? body.metaKeywords.map((keyword) => toStr(keyword)).filter(Boolean) : splitList(body.metaKeywords),
            canonicalUrl: toStr(body.canonicalUrl),
            ogTitle: toStr(body.ogTitle),
            ogDescription: toStr(body.ogDescription),
            ogImage: toStr(body.ogImage),
            twitterCardTitle: toStr(body.twitterCardTitle),
            twitterCardImage: toStr(body.twitterCardImage),
            robots: toStr(body.robots, 'index'),
            sitemapInclude: toBool(body.sitemapInclude, true),
            tableOfContents: Array.isArray(body.tableOfContents) ? body.tableOfContents : [],
            readingTime: toStr(body.readingTime),
            viewsCount: Math.max(0, toNum(body.viewsCount, 0)),
            likesCount: Math.max(0, toNum(body.likesCount, 0)),
            sharesCount: Math.max(0, toNum(body.sharesCount, 0)),
            commentsEnabled: toBool(body.commentsEnabled, true),
            adSlot1: toStr(body.adSlot1),
            adSlot2: toStr(body.adSlot2),
            adSlot3: toStr(body.adSlot3),
            affiliateLinks: Array.isArray(body.affiliateLinks) ? body.affiliateLinks.map((link) => toStr(link)).filter(Boolean) : splitList(body.affiliateLinks),
            galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages.map((image) => toStr(image)).filter(Boolean) : splitList(body.galleryImages),
            videoUrl: toStr(body.videoUrl),
            embedCode: toStr(body.embedCode),
            articleType: toStr(body.articleType, 'BlogPosting'),
            publishedDate: toIsoDate(body.publishedDate || body.publishDate),
            modifiedDate: toIsoDate(body.modifiedDate || Date.now()),
            authorSchema: toStr(body.authorSchema),
        }),
    },
    storefrontshopwithconfidencemaster: {
        cmsKey: 'shopWithConfidence',
        read: (section = {}) => ({
            title: toStr(section.title),
            features: readFeatures(section),
        }),
        write: (body) => ({
            title: toStr(body.title),
            features: writeFeatures(body),
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
