// LOCAL PREVIEW MODE data: mirrors the seed rows in database/listings.sql so search can be
// tried with `npm run dev` (which can't run PHP). Production always calls api/search_listings.php.
const LOCAL_LISTINGS = [
    { listing_id: 91001, name: 'Calculus Textbook', price: '35.00', condition: 'Good', image_url: 'uploads/calculus-textbook.jpg', category: 'Books', status: 'active' },
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

// Same rules as the PHP endpoint: active only, case-insensitive, matching the start of any
// word in the name or the start of the category.
export function searchLocalListings(query) {
    const q = query.toLowerCase();
    const matches = (l) => {
        const name = l.name.toLowerCase();
        return name.startsWith(q) || name.includes(' ' + q) || l.category.toLowerCase().startsWith(q);
    };
    return LOCAL_LISTINGS
        .filter((l) => l.status === 'active' && matches(l))
        .map(({ listing_id, name, price, condition, image_url }) => ({ listing_id, name, price, condition, image_url }));
}
