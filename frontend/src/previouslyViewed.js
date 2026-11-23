// Previously Viewed (card #217): calls the api/ endpoints from card #216.
export async function fetchPreviouslyViewedItems() {
    const response = await fetch('./api/get_previously_viewed_items.php', { credentials: 'same-origin' });
    return response.json();
}

// Tells the server the shopper opened this item; the caller ignores the result.
export async function recordViewedItem(listingId) {
    const response = await fetch('./api/record_viewed_item.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listing_id: listingId }),
    });
    return response.json();
}
