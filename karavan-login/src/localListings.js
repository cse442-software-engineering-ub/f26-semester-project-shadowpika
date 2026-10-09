// LOCAL PREVIEW MODE data: mirrors the seed rows in database/listings.sql so search can be
// tried with `npm run dev` (which can't run PHP). Production always calls api/search_listings.php.
const LOCAL_LISTINGS = [
    { listing_id: 91001, name: 'Calculus Textbook', price: '35.00', condition: 'Good', image_url: 'uploads/calculus-textbook.jpg', category: 'Books', status: 'active', description: 'Used for one semester. No writing or highlighting.' },
    { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', image_url: 'uploads/calculus-workbook.jpg', category: 'Books', status: 'active' },
    { listing_id: 91003, name: 'Desk Lamp', price: '15.00', condition: 'Good', image_url: 'uploads/desk-lamp.jpg', category: 'Dorm Living', status: 'active' },
    { listing_id: 91004, name: 'Calculus Notes', price: '5.00', condition: 'Fair', image_url: 'uploads/calculus-notes.jpg', category: 'Books', status: 'sold' },
    { listing_id: 91005, name: 'Physical Chemistry', price: '60.00', condition: 'Good', image_url: 'uploads/physical-chemistry.jpg', category: 'Books', status: 'active' },
    { listing_id: 91006, name: 'Genetics: A Conceptual Approach', price: '45.00', condition: 'Like New', image_url: 'uploads/genetics.jpg', category: 'Books', status: 'active' },
    { listing_id: 91007, name: 'Campbell Biology', price: '55.00', condition: 'Acceptable', image_url: 'uploads/campbell-biology.jpg', category: 'Books', status: 'active' },
    { listing_id: 91008, name: 'Organic Chemistry Textbook', price: '50.00', condition: 'Good', image_url: 'uploads/organic-chemistry.jpg', category: 'Books', status: 'active' },
    { listing_id: 91009, name: 'Introduction to Algorithms', price: '40.00', condition: 'Like New', image_url: 'uploads/intro-algorithms.jpg', category: 'Books', status: 'active' },
    { listing_id: 91010, name: 'Dorm Fridge', price: '80.00', condition: 'Good', image_url: 'uploads/dorm-fridge.jpg', category: 'Dorm Living', status: 'active' },
];

const CATEGORY_ALIASES = {
    Books: 'Textbooks',
    Electronics: 'Tech & Electronics',
    Furniture: 'Dorm Living',
    Clothing: 'Clothing & Gear',
};

const canonicalCategory = (category) => CATEGORY_ALIASES[category] || category;

export function buildSearchUrl(query, categories = [], conditions = [], minPrice = '', maxPrice = '') {
    const parameters = new URLSearchParams();
    const term = query.trim();
    if (term) parameters.set('q', term);
    if (categories.length > 0) parameters.set('categories', categories.join(','));
    if (conditions.length > 0) parameters.set('conditions', conditions.join(','));
    if (minPrice !== '') parameters.set('min_price', minPrice);
    if (maxPrice !== '') parameters.set('max_price', maxPrice);
    const queryString = parameters.toString();
    return `./api/search_listings.php${queryString ? `?${queryString}` : ''}`;
}

export const itemPageUrl = (listingId) => `./item.html?listing_id=${encodeURIComponent(listingId)}`;

export const buildItemDetailsUrl = (listingId) => `./api/get_item_details.php?listing_id=${encodeURIComponent(listingId)}`;

// Same shape as api/get_item_details.php returns for one active listing, or null when it doesn't exist.
export function findLocalListing(listingId) {
    const listing = LOCAL_LISTINGS.find((l) => String(l.listing_id) === String(listingId) && l.status === 'active');
    if (!listing) return null;
    const { listing_id, name, price, condition, category, description = null } = listing;
    return { listing_id, name, price, condition, category: canonicalCategory(category), description };
}

// Same rules as the PHP endpoint: active only, optional case-insensitive keyword matching,
// exact category and condition filtering, inclusive price bounds, OR within each multi-select filter
// type, and AND between different filter types.
export function searchLocalListings(query = '', categories = [], conditions = [], minPrice = '', maxPrice = '') {
    const q = query.trim().toLowerCase();
    const selectedCategories = new Set(categories);
    const selectedConditions = new Set(conditions);
    const minimum = minPrice === '' ? null : Number(minPrice);
    const maximum = maxPrice === '' ? null : Number(maxPrice);
    const matches = (l) => {
        const name = l.name.toLowerCase();
        const category = canonicalCategory(l.category);
        const price = Number(l.price);
        const matchesQuery = q === ''
            || name.startsWith(q)
            || name.includes(' ' + q)
            || category.toLowerCase().startsWith(q);
        const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(category);
        const matchesCondition = selectedConditions.size === 0 || selectedConditions.has(l.condition);
        const matchesMinimum = minimum === null || price >= minimum;
        const matchesMaximum = maximum === null || price <= maximum;
        return matchesQuery && matchesCategory && matchesCondition && matchesMinimum && matchesMaximum;
    };
    return LOCAL_LISTINGS
        .filter((l) => l.status === 'active' && matches(l))
        .map(({ listing_id, name, price, condition, image_url, category }) => ({
            listing_id,
            name,
            price,
            condition,
            image_url,
            category: canonicalCategory(category),
        }));
}
