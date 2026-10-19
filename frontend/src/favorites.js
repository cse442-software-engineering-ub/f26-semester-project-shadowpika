// Favorites (card #99): calls to the api/ endpoints from card #118.
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

export async function fetchFavorites() {
    const response = await fetch('./api/get_favorites.php', { credentials: 'same-origin' });
    return response.json();
}
