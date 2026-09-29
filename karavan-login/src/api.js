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

export async function logout() {
    await fetch(apiUrl('logout.php'), { method: 'POST', credentials: 'same-origin' });
}

export const proofUrl = (url) => (/^([a-z][a-z0-9+.-]*:|\/)/i.test(url) ? url : apiUrl(url));
