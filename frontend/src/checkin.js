// #205/#206 shared wire contract. All URLs remain relative to the deployed base directory.
export const LOCATION_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
export const EARTH_RADIUS_M = 6371000;
export const BLOCKED_LOCATION = 'Location access is blocked. Allow location for this site in your browser settings to check in.';

export function distanceMeters(lat, lng, targetLat, targetLng) {
    const rad = (value) => value * Math.PI / 180;
    const a = Math.sin(rad(targetLat - lat) / 2) ** 2
        + Math.cos(rad(lat)) * Math.cos(rad(targetLat)) * Math.sin(rad(targetLng - lng) / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

export function validLocation(location) {
    return location && Number.isFinite(location.lat) && Math.abs(location.lat) <= 90
        && Number.isFinite(location.lng) && Math.abs(location.lng) <= 180;
}

export function positionResult(position, meeting, now = Date.now()) {
    if (!position) return { allowed: false, message: 'Allow location to confirm that you have arrived.' };
    const { latitude, longitude, accuracy } = position.coords;
    if (!validLocation({ lat: latitude, lng: longitude }) || !Number.isFinite(accuracy) || accuracy < 0
        || !Number.isFinite(position.timestamp)) {
        return { allowed: false, message: 'Your device returned an invalid location. Try again.' };
    }
    if (now - position.timestamp > 30000 || position.timestamp - now > 5000) {
        return { allowed: false, message: 'Your location reading expired. Allow location again to refresh it.' };
    }
    if (accuracy > 100) return { allowed: false, message: 'Location accuracy is too low. Try again with a clearer signal.' };
    if (!validLocation(meeting?.location)) return { allowed: false, message: 'The agreed meeting location is unavailable.' };
    const distance = distanceMeters(latitude, longitude, meeting.location.lat, meeting.location.lng);
    return distance <= 100
        ? { allowed: true, message: "You're within the meeting area." }
        : { allowed: false, message: `You're ${Math.ceil(distance)} m away. Move within 100 m of the meeting location.` };
}

export function windowState(meeting, serverNow) {
    if (meeting.self_checked_in_at) return 'checked_in';
    if (meeting.status !== 'approved') return 'not_approved';
    if (meeting.listing_status !== 'active') return 'listing_unavailable';
    if (!validLocation(meeting.location)) return 'location_unavailable';
    if (serverNow < Date.parse(meeting.opens_at)) return 'not_open';
    if (serverNow > Date.parse(meeting.closes_at)) return 'closed';
    return 'open';
}

export const campusTime = (value) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));
const campusDate = (value) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
}).format(new Date(value));

export function windowMessage(meeting, state) {
    if (state === 'not_open') return `Check-in opens at ${campusTime(meeting.opens_at)} on ${campusDate(meeting.opens_at)}.`;
    if (state === 'closed') return 'Check-in has closed.';
    if (state === 'not_approved') return 'This meeting is not approved.';
    if (state === 'location_unavailable') return 'The agreed meeting location is unavailable.';
    if (state === 'listing_unavailable') return 'This listing is no longer available.';
    if (state === 'checked_in') return `Checked in at ${campusTime(meeting.self_checked_in_at)}.`;
    return `Check-in is open until ${campusTime(meeting.closes_at)}.`;
}

export function geolocationError(error) {
    if (error.code === 1) return BLOCKED_LOCATION;
    if (error.code === 3) return 'Location lookup timed out. Allow location again to retry.';
    return 'Your location is unavailable. Check your device location settings and try again.';
}

async function jsonRequest(url, options) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok || data.success !== true) throw new Error(data.error || 'Unable to check in. Try again.');
    return data;
}

const validTimestamp = (value) => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const validProgress = (data) => ['buyer', 'seller'].includes(data.participant_role)
    && [data.buyer_checked_in_at, data.seller_checked_in_at].every((value) => value === null || validTimestamp(value))
    && typeof data.both_checked_in === 'boolean' && typeof data.can_mark_sold === 'boolean';

export async function fetchCheckin(requestId, signal) {
    const { meeting } = await jsonRequest(`./api/get_meeting_checkin.php?request_id=${encodeURIComponent(requestId)}`, { signal });
    if (!meeting || meeting.request_id !== Number(requestId)
        || ![meeting.server_now, meeting.opens_at, meeting.closes_at].every((value) => Number.isFinite(Date.parse(value)))
        || !validProgress(meeting)
        || !['active', 'sold'].includes(meeting.listing_status)
        || (meeting.self_checked_in_at !== null && !validTimestamp(meeting.self_checked_in_at))
        || meeting.self_checked_in_at !== (meeting.participant_role === 'seller' ? meeting.seller_checked_in_at : meeting.buyer_checked_in_at)) {
        throw new Error('The meeting response is unavailable. Reload and try again.');
    }
    return meeting;
}

export async function submitCheckin(requestId, position) {
    const data = await jsonRequest('./api/check_in_meeting.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: Number(requestId), latitude: position.coords.latitude,
            longitude: position.coords.longitude, accuracy_m: position.coords.accuracy, captured_at: position.timestamp }),
    });
    if (!validProgress(data) || !validTimestamp(data.checked_in_at)
        || data.checked_in_at !== (data.participant_role === 'seller' ? data.seller_checked_in_at : data.buyer_checked_in_at)) {
        throw new Error('Check-in could not be confirmed. Reload to check its status.');
    }
    return data;
}
