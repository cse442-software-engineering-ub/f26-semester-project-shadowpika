// Seller ratings (cards #132, #134): calls to api/ratings.php.
export const REVIEW_MAX_LENGTH = 1000;

export const sellerPageUrl = (sellerId) => `./seller.html?seller_id=${encodeURIComponent(sellerId)}`;

export async function fetchSellerRatings(sellerId) {
    const response = await fetch(`./api/ratings.php?seller_id=${encodeURIComponent(sellerId)}`, {
        credentials: 'same-origin', cache: 'no-store',
    });
    return response.json();
}

export async function submitRating(sellerId, rating, review) {
    const response = await fetch('./api/ratings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ seller_id: Number(sellerId), rating: Number(rating), review }),
    });
    return response.json();
}

export function ratingSummaryText(average, count) {
    if (!count) return 'No ratings yet';
    return `${Number(average).toFixed(1)} (${count} ${count === 1 ? 'rating' : 'ratings'})`;
}
