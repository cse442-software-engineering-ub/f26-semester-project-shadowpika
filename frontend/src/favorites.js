// Favorites (cards #99, #180): calls to the api/ endpoints from cards #118 and #179.
export async function fetchFavoriteStatus(listingId) {
    const response = await fetch(`./api/get_favorite_status.php?listing_id=${encodeURIComponent(listingId)}`, { credentials: 'same-origin' });
    return response.json();
}

export async function saveFavorite(listingId) {
    const response = await fetch('./api/save_favorite.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listing_id: Number(listingId) }),
    });
    return response.json();
}

export async function removeFavorite(listingId) {
    const response = await fetch('./api/remove_favorite.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listing_id: Number(listingId) }),
    });
    return response.json();
}

export async function fetchFavorites() {
    const response = await fetch('./api/get_favorites.php', { credentials: 'same-origin' });
    return response.json();
}
