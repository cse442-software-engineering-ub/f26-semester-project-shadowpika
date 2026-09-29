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
