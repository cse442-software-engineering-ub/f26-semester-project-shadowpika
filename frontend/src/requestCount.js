// Purchase request count line on the item page (card #235): asks the server how many buyers have
// requested the item and turns the number into one line. Anything unusable shows no line at all.

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export async function fetchRequestCount(listingId) {
    // LOCAL PREVIEW MODE: `npm run dev` can't run PHP.
    if (isLocalPreview()) {
        return { success: true, listing_id: Number(listingId), request_count: 0 };
    }
    const response = await fetch(`./api/get_request_count.php?listing_id=${encodeURIComponent(listingId)}`, { credentials: 'same-origin' });
    return response.json();
}

export function requestCountText(count) {
    if (count === 0) return 'No purchase requests yet';
    if (count === 1) return '1 person has requested this item';
    return `${count} people have requested this item`;
}

// Resolves to the valid count, or null when the answer is an error or cannot be used. Never throws.
export async function loadRequestCount(listingId) {
    try {
        const data = await fetchRequestCount(listingId);
        if (data && data.success === true && Number.isInteger(data.request_count) && data.request_count >= 0) {
            return data.request_count;
        }
    } catch {
        // Network failure, empty or invalid answer: no line.
    }
    return null;
}

// Resolves to the line to show, or null when there is no usable count.
export async function loadRequestCountText(listingId) {
    const count = await loadRequestCount(listingId);
    return count === null ? null : requestCountText(count);
}
