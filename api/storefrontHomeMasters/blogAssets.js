const {
    deleteFromCloudinary,
    isCloudinaryUrl,
    isTempCloudinaryUrl,
    moveToPermanentCloudinary,
} = require('../../utils/cloudinary');

const BLOG_PERMANENT_FOLDER = 'orinket/blog';
const BLOG_IMAGE_FIELDS = ['featuredImage', 'authorImage', 'ogImage', 'twitterCardImage'];
const IMG_SRC_REGEX = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

function toStr(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeUrlList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => toStr(item)).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(/[\n,]/g)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

function extractHtmlImageUrls(html) {
    const value = toStr(html);
    if (!value) return [];

    const urls = [];
    let match;
    while ((match = IMG_SRC_REGEX.exec(value)) !== null) {
        const url = toStr(match[1]);
        if (url) urls.push(url);
    }
    IMG_SRC_REGEX.lastIndex = 0;
    return urls;
}

function collectBlogAssetUrls(section = {}) {
    const urls = new Set();

    BLOG_IMAGE_FIELDS.forEach((field) => {
        const url = toStr(section[field]);
        if (url) urls.add(url);
    });

    normalizeUrlList(section.galleryImages).forEach((url) => urls.add(url));
    extractHtmlImageUrls(section.fullContent).forEach((url) => urls.add(url));

    return [...urls];
}

async function finalizeAssetUrl(url, movedAssets) {
    const value = toStr(url);
    if (!value) return '';
    if (!isTempCloudinaryUrl(value)) return value;

    if (movedAssets.has(value)) {
        return movedAssets.get(value);
    }

    const permanentUrl = await moveToPermanentCloudinary(value, BLOG_PERMANENT_FOLDER);
    movedAssets.set(value, permanentUrl);
    return permanentUrl;
}

async function finalizeHtmlContent(html, movedAssets) {
    let nextHtml = toStr(html);
    if (!nextHtml) return '';

    const tempUrls = extractHtmlImageUrls(nextHtml).filter((url) => isTempCloudinaryUrl(url));
    const uniqueTempUrls = [...new Set(tempUrls)];

    for (const tempUrl of uniqueTempUrls) {
        const permanentUrl = await finalizeAssetUrl(tempUrl, movedAssets);
        nextHtml = nextHtml.split(tempUrl).join(permanentUrl);
    }

    return nextHtml;
}

async function prepareBlogBodyAssets(body = {}) {
    const nextBody = {
        ...body,
        galleryImages: normalizeUrlList(body.galleryImages),
    };
    const movedAssets = new Map();

    for (const field of BLOG_IMAGE_FIELDS) {
        nextBody[field] = await finalizeAssetUrl(nextBody[field], movedAssets);
    }

    nextBody.galleryImages = await Promise.all(
        nextBody.galleryImages.map((url) => finalizeAssetUrl(url, movedAssets))
    );
    nextBody.fullContent = await finalizeHtmlContent(nextBody.fullContent, movedAssets);

    const sessionTempUrls = normalizeUrlList(body.tempAssetUrls).filter((url) => isTempCloudinaryUrl(url));
    const finalizedTempUrls = new Set(movedAssets.keys());
    const cleanupTempUrls = sessionTempUrls.filter((url) => !finalizedTempUrls.has(url));

    return {
        body: nextBody,
        finalAssetUrls: collectBlogAssetUrls(nextBody),
        cleanupTempUrls: [...new Set(cleanupTempUrls)],
    };
}

async function deleteCloudinaryUrls(urls = []) {
    const uniqueUrls = [...new Set(normalizeUrlList(urls).filter((url) => isCloudinaryUrl(url)))];
    await Promise.allSettled(uniqueUrls.map((url) => deleteFromCloudinary(url)));
}

module.exports = {
    collectBlogAssetUrls,
    deleteCloudinaryUrls,
    prepareBlogBodyAssets,
};
