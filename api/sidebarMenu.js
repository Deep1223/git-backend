const SidebarMenu = require('../modal/sidebarMenu');
const CategoryMaster = require('../modal/categorymaster');
const OccasionMaster = require('../modal/occasionmaster');

function sortByOrder(collection = []) {
    return [...collection].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function makeSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const DEFAULT_SECTION_IMAGES = {
    her: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=640&auto=format&fit=crop',
    him: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=640&auto=format&fit=crop',
    trending: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=640&auto=format&fit=crop',
    recommended: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=640&auto=format&fit=crop',
    silver: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=640&auto=format&fit=crop',
    gifting: 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=640&auto=format&fit=crop',
};

function getCategoryPreviewItems(categoryGridRows, limit = 6) {
    return categoryGridRows.slice(0, limit).map((row) => ({
        label: row.name,
        href: row.href,
        imageUrl: row.imageUrl || '',
    }));
}

function buildDynamicSectionItems(section, categoryGridRows, occasionGridRows) {
    const title = String(section?.title || '').trim().toLowerCase();

    if (title === 'new arrivals') {
        return [
            { label: 'Latest Drops', href: '/promo?section=demiFineJewelleryProducts', imageUrl: DEFAULT_SECTION_IMAGES.trending },
            { label: 'Trending Now', href: '/promo?section=trendingProducts', imageUrl: DEFAULT_SECTION_IMAGES.trending },
            { label: 'Top Styles', href: '/promo?section=topStylesProducts', imageUrl: DEFAULT_SECTION_IMAGES.recommended },
            { label: 'Recommended', href: '/promo?section=recommendedProducts', imageUrl: DEFAULT_SECTION_IMAGES.recommended },
        ];
    }
    if (title === 'best seller' || title === 'bestseller') {
        return [
            { label: 'Top Styles', href: '/promo?section=topStylesProducts', imageUrl: DEFAULT_SECTION_IMAGES.trending },
            { label: 'Most Loved', href: '/promo?section=recommendedProducts', imageUrl: DEFAULT_SECTION_IMAGES.recommended },
            { label: 'Demi-fine Favourites', href: '/promo?section=demiFineJewelleryProducts', imageUrl: DEFAULT_SECTION_IMAGES.trending },
        ];
    }
    if (title === 'fine silver') {
        return [
            { label: '925 Silver Post', href: '/promo?section=showIn925SilverPost', imageUrl: DEFAULT_SECTION_IMAGES.silver },
        ];
    }
    if (title === 'shop by occasion') {
        return occasionGridRows.slice(0, 8).map((row) => ({
            label: row.name,
            href: row.href,
            imageUrl: row.imageUrl || '',
        }));
    }
    if (title === 'shop by collection') {
        return getCategoryPreviewItems(categoryGridRows, 8);
    }
    if (title === 'shop by gender') {
        return [
            { label: 'Gifts For Her', href: '/promo?recipient=her', imageUrl: DEFAULT_SECTION_IMAGES.her },
            { label: 'Gifts For Him', href: '/promo?recipient=him', imageUrl: DEFAULT_SECTION_IMAGES.him },
        ];
    }
    if (title === 'gifting' || title === "shraddha's favourite" || title === 'corporate gifting') {
        return [
            { label: 'Gifts For Her', href: '/promo?recipient=her', imageUrl: DEFAULT_SECTION_IMAGES.her },
            { label: 'Gifts For Him', href: '/promo?recipient=him', imageUrl: DEFAULT_SECTION_IMAGES.him },
        ];
    }
    return Array.isArray(section?.items) ? section.items : [];
}

async function publicPayload(doc) {
    const normalized = doc.toObject ? doc.toObject() : doc;
    const categoryMasterRows = await CategoryMaster.find({ status: 1 })
        .select('_id categoryname categoryimage recordinfo')
        .sort({ 'recordinfo.createat': 1, categoryname: 1 })
        .lean();
    const categoryGridRows = categoryMasterRows.map((row, index) => ({
        id: makeSlug(row.categoryname) || String(row._id),
        name: String(row.categoryname || '').trim() || 'Category',
        href: `/category/${String(row._id)}`,
        imageUrl: typeof row.categoryimage === 'string' ? row.categoryimage.trim() : '',
        isVisible: true,
        order: index + 1,
    }));
    const occasionMasterRows = await OccasionMaster.find({ status: 1 })
        .select('_id occasionname image sortorder')
        .sort({ sortorder: 1, occasionname: 1 })
        .lean();
    const occasionGridRows = occasionMasterRows.map((row, index) => ({
        id: String(row._id),
        name: String(row.occasionname || '').trim() || 'Occasion',
        href: `/promo?occasion=${encodeURIComponent(String(row._id))}`,
        imageUrl: typeof row.image === 'string' ? row.image.trim() : '',
        isVisible: true,
        order: index + 1,
    }));
    const dynamicSections = sortByOrder(normalized.sections || [])
        .filter((item) => item.isVisible !== false)
        .map((section) => ({
            ...section,
            items: buildDynamicSectionItems(section, categoryGridRows, occasionGridRows),
        }));

    return {
        tabs: sortByOrder(normalized.tabs || []).filter((item) => item.isVisible !== false),
        // Always render full Category Master list in drawer category grid.
        categories: categoryGridRows,
        occasions: occasionGridRows,
        sections: dynamicSections,
        footerLinks: sortByOrder(normalized.footerLinks || []).filter((item) => item.isVisible !== false),
    };
}

async function getMenu() {
    return SidebarMenu.findOne().sort({ createdAt: 1 });
}

async function ensureMenuDocument() {
    let doc = await getMenu();
    if (!doc) {
        doc = await SidebarMenu.create({
            tabs: [],
            categories: [],
            sections: [],
            footerLinks: [],
        });
    }
    return doc;
}

exports.postPublicSidebarMenu = async (req, res) => {
    try {
        const doc = await getMenu();
        if (!doc) {
            return res.status(200).json({
                success: true,
                data: { tabs: [], categories: [], occasions: [], sections: [], footerLinks: [] },
                message: 'Sidebar menu not configured',
            });
        }
        return res.status(200).json({
            success: true,
            data: await publicPayload(doc),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.getSidebarMenuMaster = async (req, res) => {
    try {
        const doc = await ensureMenuDocument();
        return res.status(200).json({
            success: true,
            data: doc,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message,
        });
    }
};

exports.createSidebarMenuCategory = async (req, res) => {
    try {
        const { name, href, imageUrl = '' } = req.body || {};
        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const doc = await ensureMenuDocument();
        const nextOrder = (doc.categories || []).length + 1;
        const id = makeSlug(name);
        const alreadyExists = (doc.categories || []).some((category) => category.id === id);
        const safeId = alreadyExists ? `${id}-${Date.now()}` : id;

        doc.categories.push({
            id: safeId,
            name: String(name).trim(),
            href: href && String(href).trim() ? String(href).trim() : '/category/all',
            imageUrl: String(imageUrl || '').trim(),
            isVisible: true,
            order: nextOrder,
        });
        doc.updatedBy = req.user?.id || req.user?._id || '';
        await doc.save();

        return res.status(201).json({
            success: true,
            message: 'Category created',
            data: doc,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.updateSidebarMenuCategory = async (req, res) => {
    try {
        const { id, name, href, imageUrl, isVisible } = req.body || {};
        if (!id) {
            return res.status(400).json({ success: false, message: 'Category id is required' });
        }

        const doc = await ensureMenuDocument();
        const index = (doc.categories || []).findIndex((category) => category.id === id);
        if (index < 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        if (typeof name === 'string' && name.trim()) {
            doc.categories[index].name = name.trim();
        }
        if (typeof href === 'string' && href.trim()) {
            doc.categories[index].href = href.trim();
        }
        if (typeof imageUrl === 'string') {
            doc.categories[index].imageUrl = imageUrl.trim();
        }
        if (typeof isVisible === 'boolean') {
            doc.categories[index].isVisible = isVisible;
        }

        doc.updatedBy = req.user?.id || req.user?._id || '';
        await doc.save();
        return res.status(200).json({
            success: true,
            message: 'Category updated',
            data: doc,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.deleteSidebarMenuCategory = async (req, res) => {
    try {
        const { id } = req.body || {};
        if (!id) {
            return res.status(400).json({ success: false, message: 'Category id is required' });
        }

        const doc = await ensureMenuDocument();
        const before = doc.categories.length;
        doc.categories = doc.categories.filter((category) => category.id !== id);

        if (before === doc.categories.length) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        doc.categories = doc.categories.map((category, index) => ({
            ...category.toObject(),
            order: index + 1,
        }));
        doc.updatedBy = req.user?.id || req.user?._id || '';
        await doc.save();

        return res.status(200).json({
            success: true,
            message: 'Category deleted',
            data: doc,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.reorderSidebarMenuSections = async (req, res) => {
    try {
        const { sectionIds } = req.body || {};
        if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
            return res.status(400).json({ success: false, message: 'sectionIds must be a non-empty array' });
        }

        const doc = await ensureMenuDocument();
        const orderMap = new Map(sectionIds.map((id, idx) => [id, idx + 1]));
        doc.sections = doc.sections.map((section) => {
            const raw = section.toObject();
            return {
                ...raw,
                order: orderMap.has(section.id) ? orderMap.get(section.id) : raw.order,
            };
        });
        doc.updatedBy = req.user?.id || req.user?._id || '';
        await doc.save();

        return res.status(200).json({
            success: true,
            message: 'Sections reordered',
            data: doc,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.toggleSidebarMenuVisibility = async (req, res) => {
    try {
        const { type, id, isVisible } = req.body || {};
        if (!['tab', 'category', 'section', 'footerLink'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid type' });
        }
        if (!id) {
            return res.status(400).json({ success: false, message: 'Item id is required' });
        }
        if (typeof isVisible !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isVisible must be boolean' });
        }

        const collectionMap = {
            tab: 'tabs',
            category: 'categories',
            section: 'sections',
            footerLink: 'footerLinks',
        };
        const key = collectionMap[type];

        const doc = await ensureMenuDocument();
        const index = (doc[key] || []).findIndex((item) => item.id === id);
        if (index < 0) {
            return res.status(404).json({ success: false, message: `${type} not found` });
        }

        doc[key][index].isVisible = isVisible;
        doc.updatedBy = req.user?.id || req.user?._id || '';
        await doc.save();

        return res.status(200).json({
            success: true,
            message: 'Visibility updated',
            data: doc,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
