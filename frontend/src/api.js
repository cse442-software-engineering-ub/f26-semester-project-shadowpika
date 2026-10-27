import { apiUrl } from './routes.js';

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return { success: false, error: 'Unexpected response from the server.' };
    }
}

// Approve/join bodies also have "status" (approved|denied|pending). Keep the HTTP code on `status`.
async function jsonWithHttpStatus(response) {
    const body = await readJson(response);
    return { ...body, status: response.status };
}

export async function submitAdminRegistration(formData) {
    const response = await fetch(apiUrl('admin_register.php'), {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
    });
    return jsonWithHttpStatus(response);
}

export async function fetchPendingRequests() {
    const response = await fetch(apiUrl('moderator_requests.php'), { credentials: 'same-origin' });
    return jsonWithHttpStatus(response);
}

export async function decideRequest(requestId, action) {
    const response = await fetch(apiUrl('moderator_approve.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ request_id: requestId, action }),
    });
    return jsonWithHttpStatus(response);
}

// Doubles as the admin check: anyone who isn't an admin gets a 403.
export async function fetchApprovedLocations() {
    const response = await fetch(apiUrl('get_approved_locations.php'), { credentials: 'same-origin' });
    return jsonWithHttpStatus(response);
}

export async function addApprovedLocation({ lat, lng, label }) {
    const response = await fetch(apiUrl('add_approved_location.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ lat, lng, label }),
    });
    return jsonWithHttpStatus(response);
}

export async function removeApprovedLocation(locationId) {
    const response = await fetch(apiUrl('remove_approved_location.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ location_id: locationId }),
    });
    return jsonWithHttpStatus(response);
}

// The navbar and Sell form both need this list when Sell first opens. Share only
// an in-flight request so the page sends one GET, while later picker refreshes
// still reach the server.
let communitiesRequest = null;

// Doubles as the logged-in check for the nav: signed-out visitors get a 403.
export async function fetchCommunities() {
    if (communitiesRequest) return communitiesRequest;

    const request = (async () => {
        const response = await fetch(apiUrl('list_communities.php'), { credentials: 'same-origin' });
        return jsonWithHttpStatus(response);
    })();
    communitiesRequest = request;

    try {
        return await request;
    } finally {
        if (communitiesRequest === request) communitiesRequest = null;
    }
}

export async function fetchMeetingLocations(community) {
    const query = new URLSearchParams({ community });
    const response = await fetch(apiUrl(`api/get_meeting_locations.php?${query.toString()}`), {
        credentials: 'same-origin',
    });
    return jsonWithHttpStatus(response);
}

export async function fetchAdminStatus() {
    const response = await fetch(apiUrl('admin_status.php'), { credentials: 'same-origin' });
    return jsonWithHttpStatus(response);
}

export async function fetchJoinRequests() {
    const response = await fetch(apiUrl('get_join_requests.php'), { credentials: 'same-origin' });
    return jsonWithHttpStatus(response);
}

export async function decideJoinRequest(userId, communityId, action) {
    const response = await fetch(apiUrl('approve_join_request.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, community_id: communityId, action }),
    });
    return jsonWithHttpStatus(response);
}

export async function joinCommunity(communityId) {
    const response = await fetch(apiUrl('join_community.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ community_id: communityId }),
    });
    const body = await readJson(response);
    // The JSON body also has "status" (pending|joined); keep the HTTP code on `status`.
    return { ...body, status: response.status, joinStatus: body.status };
}

export async function leaveCommunity(communityId) {
    const response = await fetch(apiUrl('leave_community.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ community_id: communityId }),
    });
    return jsonWithHttpStatus(response);
}

export async function setShoppingCommunities(communityIds) {
    const response = await fetch(apiUrl('set_shopping_communities.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ community_ids: communityIds }),
    });
    return jsonWithHttpStatus(response);
}

// `npm run dev` on localhost has no PHP, so the login page fakes accounts in localStorage;
// `npm run dev:backend` sets VITE_LOCAL_BACKEND so localhost uses the real PHP endpoints.
export function isLocalMockBackend(location = window.location) {
    const isLocalHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocalHost && import.meta.env.VITE_LOCAL_BACKEND !== 'true';
}

// 200 with logged_in: true for a signed-in user (restoring a remembered login if needed), 401 otherwise.
export async function fetchSession() {
    const response = await fetch(apiUrl('session.php'), { credentials: 'same-origin' });
    return jsonWithHttpStatus(response);
}

export const isLoggedIn = (session) => session.status === 200 && session.logged_in === true;

export async function logout() {
    await fetch(apiUrl('logout.php'), { method: 'POST', credentials: 'same-origin' });
}

export const proofUrl = (url) => (/^([a-z][a-z0-9+.-]*:|\/)/i.test(url) ? url : apiUrl(url));
