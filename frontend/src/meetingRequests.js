// Buyer meeting requests (card #168): calls to the api/ endpoints from card #167, the form checks
// that run before anything is sent, and the formatting the Home page shows.
import { buildItemDetailsUrl, findLocalListing } from './localListings.js';

export const meetPageUrl = (listingId, from = '') =>
    `./meet.html?listing_id=${encodeURIComponent(listingId)}${from ? `&from=${from}` : ''}`;

// Only known values ('request', 'favorites') pass, so the raw address value never reaches another URL.
export const itemPageFrom = (search) => {
    const from = new URLSearchParams(search).get('from');
    return from === 'request' || from === 'favorites' ? from : '';
};

export const itemUrlFrom = (listingId, from = '') =>
    `./item.html?listing_id=${encodeURIComponent(listingId)}${from ? `&from=${from}` : ''}`;

// The item page opened from a purchase request: back goes to Home.
export const requestItemUrl = (listingId) => `./item.html?listing_id=${encodeURIComponent(listingId)}&from=request`;

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// LOCAL PREVIEW MODE answers from the seed rows because `npm run dev` can't run PHP.
export async function loadListing(listingId) {
    if (isLocalPreview()) {
        const listing = findLocalListing(listingId);
        return listing ? { success: true, listing } : { success: false, error: 'Listing not found.' };
    }
    const response = await fetch(buildItemDetailsUrl(listingId));
    return response.json();
}

export async function fetchListingOwnership(listingId) {
    const response = await fetch(`./api/get_listing_ownership.php?listing_id=${encodeURIComponent(listingId)}`, { credentials: 'same-origin' });
    return response.json();
}

export async function fetchMeetingLocations(community) {
    const query = new URLSearchParams({ community: community ?? '' });
    const response = await fetch(`./api/get_meeting_locations.php?${query}`, { credentials: 'same-origin' });
    return response.json();
}

export async function fetchMyMeetingRequests() {
    const response = await fetch('./api/get_my_meeting_requests.php', { credentials: 'same-origin', cache: 'no-store' });
    return response.json();
}

export async function fetchIncomingMeetingRequests() {
    const response = await fetch('./api/get_incoming_meeting_requests.php', { credentials: 'same-origin', cache: 'no-store' });
    return response.json();
}

export async function createMeetingRequest({ listingId, date, time, locationId, offerPrice }) {
    const body = {
        listing_id: Number(listingId),
        meeting_date: date,
        meeting_time: time,
        location_id: Number(locationId),
    };
    if (offerPrice !== undefined && offerPrice !== null) body.offer_price = String(offerPrice).trim();
    const response = await fetch('./api/create_meeting_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    return response.json();
}

export async function cancelMeetingRequest(listingId) {
    const response = await fetch('./api/cancel_meeting_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ listing_id: Number(listingId) }),
    });
    return response.json();
}

// Seller answer (card #178): approve, deny, or change_location (which also sends the new location's id).
export async function respondMeetingRequest(requestId, action, locationId) {
    const body = { request_id: Number(requestId), action };
    if (action === 'change_location') body.location_id = Number(locationId);
    const response = await fetch('./api/respond_meeting_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    return response.json();
}

// Buyer accepts the seller's new location (card #220).
export async function acceptLocationChange(requestId) {
    const response = await fetch('./api/accept_location_change.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ request_id: Number(requestId) }),
    });
    return response.json();
}

// Buyer denies the seller's new location; the request goes back to pending (card #220).
export async function denyLocationChange(requestId) {
    const response = await fetch('./api/deny_location_change.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ request_id: Number(requestId) }),
    });
    return response.json();
}

// Seller dismisses the "Location change accepted/denied" label (card #220).
export async function dismissLocationChangeResult(requestId) {
    const response = await fetch('./api/dismiss_location_change_result.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ request_id: Number(requestId) }),
    });
    return response.json();
}

// "Today" is the campus date, matching the backend's future-date check.
export const campusToday = (now = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);

// Same checks, order, and messages as the backend, so nothing incomplete is ever sent.
export function meetingRequestError({ date, time, locationId }, today = campusToday()) {
    if (!locationId) return 'A meeting location is required.';
    if (!date) return 'A date is required.';
    if (!time) return 'A time is required.';
    if (date <= today) return 'The meeting date must be in the future.';
    return '';
}

// Price offers (card #115): the same limits as the backend, in whole cents so rounding never differs.
const priceToCents = (price) => {
    const [whole, fraction = ''] = String(price).trim().split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
};
const centsToText = (cents) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

// Lowest and highest allowed offers as "X.XX" text: 60% rounded up, 150% rounded down.
export function offerLimits(price) {
    const cents = priceToCents(price);
    return { min: centsToText(Math.ceil((cents * 60) / 100)), max: centsToText(Math.floor((cents * 150) / 100)) };
}

// Same checks, order, and messages as the backend. Returns '' when the offer is fine.
export function offerError(price, value) {
    const text = String(value ?? '').trim();
    if (text === '') return 'Enter your offer amount.';
    if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(text)) return 'Enter a valid dollar amount with no more than two decimal places.';
    const offer = priceToCents(text);
    const { min, max } = offerLimits(price);
    if (offer < priceToCents(min)) return `Your offer must be at least $${min}.`;
    if (offer > priceToCents(max)) return `Your offer can be at most $${max}.`;
    if (offer === priceToCents(price)) return `Your offer must be different from the asking price of $${centsToText(priceToCents(price))}.`;
    return '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-12-08" → "Dec 8". Parsed by hand so the browser's timezone can't shift the day.
export function formatMeetingDate(value) {
    const [, month, day] = String(value).split('-').map(Number);
    return MONTHS[month - 1] ? `${MONTHS[month - 1]} ${day}` : String(value);
}

// "14:30" → "2:30 PM", "00:30" → "12:30 AM".
export function formatMeetingTime(value) {
    const [hours, minutes] = String(value).split(':');
    const hour = Number(hours);
    if (Number.isNaN(hour) || minutes === undefined) return String(value);
    return `${hour % 12 || 12}:${minutes.slice(0, 2)} ${hour < 12 ? 'AM' : 'PM'}`;
}

export const STATUS_LABELS = {
    pending: 'Pending',
    approved: 'Approved',
    denied: 'Denied',
    location_change_requested: 'Location Change Requested',
};
