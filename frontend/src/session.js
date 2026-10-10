import { apiUrl } from './routes.js';
import { saveJoinedCommunity } from './community.js';

// Isolated so task tests can verify the request without navigating the test runner.
export const navigateTo = (url) => window.location.replace(url);

export async function signOut(navigate = navigateTo) {
    const response = await fetch(apiUrl('logout.php'), {
        method: 'POST',
        credentials: 'same-origin',
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Logout failed.');
    saveJoinedCommunity(null);
    navigate(apiUrl('index.html'));
}

export function hasAuthCookie(cookie = document.cookie) {
    return cookie.split(';').some((part) => {
        const value = part.trim();
        return value.startsWith('karavan_auth_cookie=') && value.length > 'karavan_auth_cookie='.length;
    });
}
