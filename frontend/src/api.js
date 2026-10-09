import { apiUrl } from './routes.js';

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return { success: false, error: 'Unexpected response from the server.' };
    }
}

export async function submitAdminRegistration(formData) {
    const response = await fetch(apiUrl('admin_register.php'), {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
    });
    return { status: response.status, ...(await readJson(response)) };
}

export async function fetchPendingRequests() {
    const response = await fetch(apiUrl('moderator_requests.php'), { credentials: 'same-origin' });
    return { status: response.status, ...(await readJson(response)) };
}

export async function decideRequest(requestId, action) {
    const response = await fetch(apiUrl('moderator_approve.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ request_id: requestId, action }),
    });
    return { status: response.status, ...(await readJson(response)) };
}

// Doubles as the admin check: anyone who isn't an admin gets a 403.
export async function fetchApprovedLocations() {
    const response = await fetch(apiUrl('get_approved_locations.php'), { credentials: 'same-origin' });
    return { status: response.status, ...(await readJson(response)) };
}

export async function addApprovedLocation({ lat, lng, label }) {
    const response = await fetch(apiUrl('add_approved_location.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ lat, lng, label }),
    });
    return { status: response.status, ...(await readJson(response)) };
}

export async function removeApprovedLocation(locationId) {
    const response = await fetch(apiUrl('remove_approved_location.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ location_id: locationId }),
    });
    return { status: response.status, ...(await readJson(response)) };
}

// Doubles as the logged-in check for the nav: signed-out visitors get a 403.
export async function fetchCommunities() {
    const response = await fetch(apiUrl('list_communities.php'), { credentials: 'same-origin' });
    return { status: response.status, ...(await readJson(response)) };
}

export async function joinCommunity(communityId) {
    const response = await fetch(apiUrl('join_community.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ community_id: communityId }),
    });
    return { status: response.status, ...(await readJson(response)) };
}

export async function logout() {
    await fetch(apiUrl('logout.php'), { method: 'POST', credentials: 'same-origin' });
}

export const proofUrl = (url) => (/^([a-z][a-z0-9+.-]*:|\/)/i.test(url) ? url : apiUrl(url));
