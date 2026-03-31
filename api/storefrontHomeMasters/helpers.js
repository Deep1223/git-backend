function parseCms(raw) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function toStr(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return String(value).trim();
}

function toNum(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function splitList(raw) {
    const value = toStr(raw);
    if (!value) return [];
    return value
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter(Boolean);
}

const mongoose = require('mongoose');

/** Unique valid ObjectId strings from comma/newline-separated input (e.g. dashboard Top Styles product list). */
function parseObjectIdList(raw, maxLen = 50) {
    const list = splitList(raw);
    const uniq = [...new Set(list.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    return uniq.slice(0, maxLen);
}

function setRecordInfo(doc, username) {
    if (!doc.recordinfo || typeof doc.recordinfo !== 'object') doc.recordinfo = {};
    doc.recordinfo.updateby = username || 'system';
    doc.recordinfo.updateat = Date.now();
}

const mapRowHelpers = {
    readRecipient(section, index) {
        const row = Array.isArray(section.recipients) ? section.recipients[index - 1] : null;
        return {
            [`recipient${index}Title`]: toStr(row?.title),
            [`recipient${index}Image`]: toStr(row?.image),
            [`recipient${index}Href`]: toStr(row?.href),
        };
    },
    writeRecipient(body, index) {
        return {
            title: toStr(body[`recipient${index}Title`]),
            image: toStr(body[`recipient${index}Image`]),
            href: toStr(body[`recipient${index}Href`]),
        };
    },
    readOccasion(section, index) {
        const row = Array.isArray(section.occasions) ? section.occasions[index - 1] : null;
        return {
            [`occasion${index}Title`]: toStr(row?.title),
            [`occasion${index}Subtitle`]: toStr(row?.subtitle),
            [`occasion${index}Image`]: toStr(row?.image),
            [`occasion${index}Href`]: toStr(row?.href),
        };
    },
    writeOccasion(body, index) {
        return {
            title: toStr(body[`occasion${index}Title`]),
            subtitle: toStr(body[`occasion${index}Subtitle`]),
            image: toStr(body[`occasion${index}Image`]),
            href: toStr(body[`occasion${index}Href`]),
        };
    },
    readPost(section, index) {
        const row = Array.isArray(section.posts) ? section.posts[index - 1] : null;
        return {
            [`post${index}Slug`]: toStr(row?.slug),
            [`post${index}Title`]: toStr(row?.title),
            [`post${index}Excerpt`]: toStr(row?.excerpt),
            [`post${index}Image`]: toStr(row?.image),
            [`post${index}DateLabel`]: toStr(row?.dateLabel),
            [`post${index}Href`]: toStr(row?.href),
        };
    },
    writePost(body, index) {
        return {
            slug: toStr(body[`post${index}Slug`]),
            title: toStr(body[`post${index}Title`]),
            excerpt: toStr(body[`post${index}Excerpt`]),
            image: toStr(body[`post${index}Image`]),
            dateLabel: toStr(body[`post${index}DateLabel`]),
            href: toStr(body[`post${index}Href`]),
        };
    },
    readFeature(section, index) {
        const row = Array.isArray(section.features) ? section.features[index - 1] : null;
        return {
            [`feature${index}Title`]: toStr(row?.title),
            [`feature${index}Description`]: toStr(row?.description),
            [`feature${index}Threshold`]: row?.freeShippingThresholdInr ?? 0,
        };
    },
    writeFeature(body, index) {
        const threshold = toNum(body[`feature${index}Threshold`], 0);
        return {
            title: toStr(body[`feature${index}Title`]),
            description: toStr(body[`feature${index}Description`]),
            freeShippingThresholdInr: threshold > 0 ? threshold : undefined,
        };
    },
    readReview(section, index) {
        const row = Array.isArray(section.reviews) ? section.reviews[index - 1] : null;
        return {
            [`review${index}Id`]: toStr(row?.id),
            [`review${index}Name`]: toStr(row?.name),
            [`review${index}Location`]: toStr(row?.location),
            [`review${index}Rating`]: row?.rating ?? 5,
            [`review${index}Text`]: toStr(row?.text),
            [`review${index}Product`]: toStr(row?.product),
        };
    },
    writeReview(body, index) {
        return {
            id: toStr(body[`review${index}Id`]),
            name: toStr(body[`review${index}Name`]),
            location: toStr(body[`review${index}Location`]),
            rating: toNum(body[`review${index}Rating`], 5),
            text: toStr(body[`review${index}Text`]),
            product: toStr(body[`review${index}Product`]),
        };
    },
    readStore(section, index) {
        const row = Array.isArray(section.stores) ? section.stores[index - 1] : null;
        return {
            [`store${index}Name`]: toStr(row?.name),
            [`store${index}City`]: toStr(row?.city),
            [`store${index}Address`]: toStr(row?.address),
            [`store${index}Image`]: toStr(row?.image),
            [`store${index}Href`]: toStr(row?.href),
        };
    },
    writeStore(body, index) {
        return {
            name: toStr(body[`store${index}Name`]),
            city: toStr(body[`store${index}City`]),
            address: toStr(body[`store${index}Address`]),
            image: toStr(body[`store${index}Image`]),
            href: toStr(body[`store${index}Href`]),
        };
    },
};

module.exports = {
    parseCms,
    toStr,
    toNum,
    splitList,
    parseObjectIdList,
    setRecordInfo,
    mapRowHelpers,
};
