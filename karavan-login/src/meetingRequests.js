// Buyer meeting requests (card #168): calls to the api/ endpoints from card #167, the form checks
// that run before anything is sent, and the formatting the Home page shows.
import { buildItemDetailsUrl, findLocalListing } from './localListings.js';

export const meetPageUrl = (listingId) => `./meet.html?listing_id=${encodeURIComponent(listingId)}`;

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

export async function fetchMeetingLocations() {
    const response = await fetch('./api/get_meeting_locations.php', { credentials: 'same-origin' });
    return response.json();
}

export async function fetchMyMeetingRequests() {
    const response = await fetch('./api/get_my_meeting_requests.php', { credentials: 'same-origin' });
    return response.json();
}

export async function createMeetingRequest({ listingId, date, time, locationId }) {
    const response = await fetch('./api/create_meeting_request.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            listing_id: Number(listingId),
            meeting_date: date,
            meeting_time: time,
            location_id: Number(locationId),
        }),
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
