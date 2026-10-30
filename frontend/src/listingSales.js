import { apiUrl } from './routes.js';

// Status changes are confirmed by the server before any UI claims success.
export async function updateListing(body) {
    const response = await fetch(apiUrl('listing/api/update_listing.php'), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.success !== true) throw new Error(data.error || 'Unable to update the listing. Try again.');
    return data;
}

export const validCheckinTime = (value) => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

export function canCheckIn(request, seller = false) {
    return request.status === 'approved' && request.listing_status === 'active'
        && Number.isInteger(request.request_id) && request.request_id > 0
        && (seller ? request.seller_checked_in_at : request.checked_in_at) === null;
}

export function canMarkSold(request) {
    return request.status === 'approved' && request.listing_status === 'active'
        && request.can_mark_sold === true && request.both_checked_in === true
        && validCheckinTime(request.buyer_checked_in_at) && validCheckinTime(request.seller_checked_in_at)
        && Number.isInteger(request.request_id) && request.request_id > 0;
}
