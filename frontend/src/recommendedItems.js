// Recommended Items (card #200): calls the api/ endpoint from card #199.
export async function fetchRecommendedItems() {
    const response = await fetch('./api/get_recommended_items.php', { credentials: 'same-origin' });
    return response.json();
}
