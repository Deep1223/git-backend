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
            title: 'ORINKET TOP STYLES',
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
            ornament: '— Orinket —',
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
                "At Orinket, we create jewellery that's made to be worn every day and on the days that matter most.",
                "We don't believe in saving the good stuff for later. The sparkle is always yours to keep.",
            ],
            cta: { text: 'OUR STORY', href: '/about' },
        },
        founderMessage: {
            title: 'FROM PRIYA, FOR YOU',
            quote: 'A new category called Demi-Fine: premium quality, better pricing, better durability.',
            description:
                "At Orinket, we're building jewellery in the middle of real gold and imitation, with premium metals and lasting quality.",
            name: 'Priya Sharma',
            role: 'Founder & Creative Director, Orinket',
            image: img.portrait,
            alt: 'Priya Sharma - Founder of Orinket',
        },
        blogSection: {
            title: 'BLOGS',
            posts: [
                {
                    slug: 'lab-grown-diamonds',
                    title: 'Lab-Grown Diamonds: Styling & Care',
                    excerpt: 'Real, pretty and low-drama jewellery for modern women.',
                    image: img.blog1,
                    dateLabel: '03 Mar 2026',
                    href: '/blog/lab-grown-diamonds',
                },
                {
                    slug: 'womens-day-guide',
                    title: "Women's Day Jewellery Guide",
                    excerpt: 'From statements to everyday wear, curated pieces for every mood.',
                    image: img.blog2,
                    dateLabel: '02 Mar 2026',
                    href: '/blog/womens-day-guide',
                },
                {
                    slug: 'gold-vs-silver',
                    title: 'Gold vs Silver Jewellery',
                    excerpt: 'How to choose what suits you best.',
                    image: img.blog3,
                    dateLabel: '01 Mar 2026',
                    href: '/blog/gold-vs-silver',
                },
            ],
            button: { text: 'READ MORE', href: '/blog' },
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
            title: 'THE ORINKET STORY',
            image: img.brandWide,
            alt: 'The Orinket Story',
            description: [
                'Orinket was born from a belief that everyone deserves beautiful jewellery without compromise.',
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
                    text: 'I absolutely love my Orinket pieces!',
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
