/**
 * SINGLE SOURCE OF TRUTH for brand strings in the backend.
 * Change ONLY `BRAND_NAME` — upper / slug / emails follow from JS.
 */
const BRAND_NAME = 'TrishaJewells'
const BRAND_NAME_UPPER = BRAND_NAME.toUpperCase()
const BRAND_SLUG = BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '')

const BRAND = {
  name: BRAND_NAME,
  nameUpper: BRAND_NAME_UPPER,
  slug: BRAND_SLUG,

  storeName: BRAND_NAME_UPPER,
  brandName: BRAND_NAME_UPPER,
  legalName: `${BRAND_NAME} Jewelry`,
  fromName: `${BRAND_NAME} Store`,
  emailFromDisplay: BRAND_NAME,

  supportEmail: `care@${BRAND_SLUG}.com`,
  supportEmailAlt: `support@${BRAND_SLUG}.com`,
  demoCustomerEmail: `demo.customer@${BRAND_SLUG}.com`,
  pinterestUrl: `https://www.pinterest.com/${BRAND_SLUG}_jewellery/`,

  contactPageTitle: `Contact ${BRAND_NAME_UPPER}`,
  topStylesTitle: `${BRAND_NAME_UPPER} TOP STYLES`,
  storyTitle: `THE ${BRAND_NAME_UPPER} STORY`,
  forEveryYouOrnament: `— ${BRAND_NAME} —`,
  editorialTeam: `${BRAND_NAME} Editorial Team`,
  founderRole: `Founder & Creative Director, ${BRAND_NAME}`,
  founderAlt: `Priya Sharma - Founder of ${BRAND_NAME}`,
  storyAlt: `The ${BRAND_NAME} Story`,

  cloudinaryRoot: BRAND_SLUG,
  cloudinaryTemp: `${BRAND_SLUG}/temp`,
  cloudinaryBlog: `${BRAND_SLUG}/blog`,
  reviewSource: `${BRAND_SLUG}-web`,

  promoCode10: `${BRAND_NAME_UPPER}10`,

  thankYouShopping: `Thank you for shopping with ${BRAND_NAME}!`,
  thankYouChoosing: `Thank you for choosing ${BRAND_NAME}!`,
  loveYourPieces: `We want you to love your ${BRAND_NAME} pieces.`,
  reviewQuote: `I absolutely love my ${BRAND_NAME} pieces!`,
  craftsmanship: `Trusted ${BRAND_NAME} craftsmanship`,

  deserveCopy: `At ${BRAND_NAME}, we create jewellery that's made to be worn every day and on the days that matter most.`,
  founderCopy: `At ${BRAND_NAME}, we're building jewellery in the middle of real gold and imitation, with premium metals and lasting quality.`,
  storyCopy: `${BRAND_NAME} was born from a belief that everyone deserves beautiful jewellery without compromise.`,

  productSlug: (categorySlug, i) => `${BRAND_SLUG}-${categorySlug}-${i}`,
  productName: (categorySlug, i) => `${BRAND_NAME} ${categorySlug} Style ${i}`,
  cloudinaryFolder: (dir) => `${BRAND_SLUG}/${String(dir).toLowerCase().replace(/\\/g, '/')}`,
  categoryFolders: [
    `${BRAND_SLUG}/bridal`,
    `${BRAND_SLUG}/earrings`,
    `${BRAND_SLUG}/mans`,
    `${BRAND_SLUG}/necklaces`,
    `${BRAND_SLUG}/ring`,
  ],
}

module.exports = { BRAND, BRAND_NAME, BRAND_NAME_UPPER, BRAND_SLUG }
