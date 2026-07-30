const { BRAND } = require('../config/brand');
const img = require('../config/storefrontCloudinaryPlaceholders');

/**
 * Full `storefrontContentJson` object for all 14 homepage section keys.
 * Used by seed script and optional reset utilities.
 */
function getDefaultStorefrontHomeContent() {
    return {
        demifineSection: {
            subtitle: 'Premium Quality',
            title: 'EVERYDAY DEMI-FINE JEWELLERY',
            description:
                'Discover our collection of 18k thick gold plated jewellery. Premium metals, lasting shine, and designs for every day.',
            cta: {
                text: 'SHOP COLLECTION',
                href: '/promo?section=demiFineJewelleryProducts',
            },
        },
        topStylesSection: {
            title: BRAND.topStylesTitle,
            categories: ['ALL', 'NECKLACES', 'BRACELETS', 'EARRINGS', 'RINGS', 'MENS', 'MANGALSUTRA'],
            discount: 30,
            categoryid: '',
            category: '',
            productIds: [],
        },
        discountBanner: {
            image: img.wideSale,
            alt: 'Special Offer',
            subtitle: 'LIMITED TIME OFFER',
            title: 'UP TO 50% OFF',
            description: 'On selected demi-fine pieces',
            cta: 'SHOP SALE',
            discountUpTo: 50,
        },
        shopByRecipient: {
            title: 'SHOP BY RECIPIENT',
            recipients: [
                { title: 'Gifts For Her', image: img.bag, href: '/promo?recipient=her' },
                { title: 'Gifts For Him', image: img.shoes, href: '/promo?recipient=him' },
            ],
        },
        forEveryYou: {
            eyebrow: 'Shop by Occasion',
            title: 'FOR EVERY YOU',
            description: 'From boardrooms to brunches, we have pieces that complement every version of you.',
            ornament: BRAND.forEveryYouOrnament,
        },
        fineGoldSection: {
            title: '925 SILVER POST',
            description: 'Lab grown diamonds set in solid 9KT gold. Premium jewelry crafted for timeless elegance',
            filters: ['All'],
            emptyState: {
                title: 'No products found',
                descriptionAll: 'This collection is empty for now.',
                descriptionFiltered: 'Try a different style using the filters above.',
            },
        },
        deserveToShine: {
            title: 'BECAUSE YOU DESERVE TO SHINE',
            image: img.deserve,
            description: [
                BRAND.deserveCopy,
                "We don't believe in saving the good stuff for later. The sparkle is always yours to keep.",
            ],
            cta: { text: 'OUR STORY', href: '/about' },
        },
        founderMessage: {
            title: 'FROM PRIYA, FOR YOU',
            quote: 'A new category called Demi-Fine: premium quality, better pricing, better durability.',
            description:
                BRAND.founderCopy,
            name: 'Priya Sharma',
            role: BRAND.founderRole,
            image: img.portrait,
            alt: BRAND.founderAlt,
        },
        blogSection: {
            title: 'Lab-Grown Diamonds: Styling, Care & Smart Buying',
            slug: 'lab-grown-diamonds-styling-care-smart-buying',
            shortDescription: 'A complete guide to choosing, styling, and caring for lab-grown diamond jewellery.',
            fullContent:
                '<h2>Why lab-grown diamonds are trending</h2><p>Modern shoppers want premium sparkle with better value and better traceability.</p><h2>How to style them</h2><p>Choose versatile pieces for daily wear and layer statement designs for occasion looks.</p><h2>Care tips</h2><p>Store your jewellery separately, avoid harsh chemicals, and clean gently for long-lasting shine.</p>',
            featuredImage: img.blog1,
            imageAltText: 'Lab-grown diamond jewellery styling guide',
            category: 'Tech',
            subCategory: 'Jewellery Guides',
            tags: ['Lab Grown', 'Diamond', 'Jewellery Care'],
            authorName: BRAND.editorialTeam,
            authorImage: img.portrait,
            sourceReference: '',
            status: 'published',
            publishDate: '2026-03-03T10:00:00.000Z',
            scheduleDate: '',
            isFeatured: true,
            isTrending: true,
            metaTitle: 'Lab-Grown Diamonds Styling and Care Guide',
            metaDescription: 'Learn how to style, maintain, and shop lab-grown diamond jewellery with confidence.',
            metaKeywords: ['lab-grown diamonds', 'diamond styling', 'jewellery care'],
            canonicalUrl: '/blog/lab-grown-diamonds-styling-care-smart-buying',
            ogTitle: 'Lab-Grown Diamonds Styling and Care Guide',
            ogDescription: 'Everything you need to know before buying and styling lab-grown diamonds.',
            ogImage: img.blog1,
            twitterCardTitle: 'Lab-Grown Diamonds Guide',
            twitterCardImage: img.blog1,
            robots: 'index',
            sitemapInclude: true,
            tableOfContents: [
                { id: 'why-lab-grown-diamonds-are-trending', text: 'Why lab-grown diamonds are trending', level: 'h2' },
                { id: 'how-to-style-them', text: 'How to style them', level: 'h2' },
                { id: 'care-tips', text: 'Care tips', level: 'h2' },
            ],
            readingTime: '2 min read',
            viewsCount: 245,
            likesCount: 32,
            sharesCount: 18,
            commentsEnabled: true,
            adSlot1: '',
            adSlot2: '',
            adSlot3: '',
            affiliateLinks: [],
            galleryImages: [img.blog1, img.blog2, img.blog3],
            videoUrl: '',
            embedCode: '',
            articleType: 'BlogPosting',
            publishedDate: '2026-03-03T10:00:00.000Z',
            modifiedDate: '2026-03-03T10:00:00.000Z',
            authorSchema: JSON.stringify({ '@type': 'Person', name: BRAND.editorialTeam }),
        },
        shopWithConfidence: {
            title: 'SHOP WITH CONFIDENCE',
            features: [
                { title: 'Free Shipping', description: 'On orders above Rs.999', freeShippingThresholdInr: 999 },
                { title: 'Easy Returns', description: '7-day return policy' },
                { title: 'Secure Payments', description: '100% secure checkout' },
                { title: 'Premium Quality', description: '18k thick gold plated' },
            ],
        },
        brandStory: {
            title: BRAND.storyTitle,
            image: img.brandWide,
            alt: BRAND.storyAlt,
            description: [
                BRAND.storyCopy,
                'We noticed a gap in the market - real gold felt expensive and imitation jewellery did not last.',
                'Today we continue making everyday demi-fine jewellery with premium quality and modern design.',
            ],
            cta: { text: 'LEARN MORE', href: '/about' },
        },
        reviews: {
            title: 'TRUSTED BY OUR COMMUNITY',
            subtitle: 'Over 5 Lakh+ Happy Customers',
            reviews: [
                {
                    id: 'r-1',
                    name: 'Ananya Sharma',
                    location: 'Mumbai',
                    rating: 5,
                    text: BRAND.reviewQuote,
                    product: 'Hearts All Over Bracelet',
                },
                {
                    id: 'r-2',
                    name: 'Priya Patel',
                    location: 'Delhi',
                    rating: 5,
                    text: "Finally found jewellery that's affordable.",
                    product: 'Round Solitaire Necklace',
                },
                {
                    id: 'r-3',
                    name: 'Shreya Kapoor',
                    location: 'Bangalore',
                    rating: 5,
                    text: 'The craftsmanship is incredible.',
                    product: 'Classic Emerald Necklace',
                },
            ],
        },
        ctaBanner: {
            title: 'BUY EVERYDAY DEMI-FINE JEWELLERY',
            description: 'Curated by Priya Sharma',
            cta: { text: 'SHOP NOW', href: '/collections/all' },
        },
        // visitStores: {
        //     title: 'VISIT OUR STORES',
        //     subtitle: 'Experience our collection in person',
        //     stores: [
        //         {
        //             name: 'Mumbai - Phoenix Mall',
        //             city: 'Mumbai',
        //             address: 'Lower Parel, Mumbai',
        //             image: img.store1,
        //             href: '/stores/mumbai-phoenix-mall',
        //         },
        //         {
        //             name: 'Delhi - Select Citywalk',
        //             city: 'Delhi',
        //             address: 'Saket, New Delhi',
        //             image: img.store2,
        //             href: '/stores/delhi-select-citywalk',
        //         },
        //     ],
        //     button: { text: 'FIND ALL STORES', href: '/stores' },
        // },
    };
}

module.exports = { getDefaultStorefrontHomeContent };
