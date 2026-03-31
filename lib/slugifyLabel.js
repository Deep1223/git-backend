/** Match storefront URL slugs from category / tab names. */
function slugifyLabel(input) {
    return String(input ?? '')
        .trim()
        .toLowerCase()
        .replace(/['\u2019]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

module.exports = { slugifyLabel };
