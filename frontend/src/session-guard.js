import { apiUrl, appBase } from './routes.js';
import { hasAuthCookie, navigateTo } from './session.js';
import { rememberItemPage } from './returnTo.js';

// Logged out. Only the first check (the page load) lets an item page go to the Log In page and be
// remembered, so a shared link survives login; every later check, and every other page, goes to 404.html.
export function redirectLoggedOut(isFirstCheck, location = window.location, navigate = navigateTo) {
    if (isFirstCheck && location.pathname.endsWith('item.html')) {
        rememberItemPage(location);
        navigate(appBase());
    } else {
        navigate(apiUrl('404.html'));
    }
}

// Retains the deployed wrappers' UI guard. PHP remains the authorization boundary.
// Dev mode allows frontend work with mocked APIs, independently of login/backend.
if (import.meta.env.PROD) {
    if (!hasAuthCookie()) redirectLoggedOut(true);
    const timer = window.setInterval(() => {
        if (!hasAuthCookie()) redirectLoggedOut(false);
    }, 1000);
    // Stop as soon as the page starts leaving: after Log Out the cookie is already gone
    // while the login page loads, and a late check would send the browser to 404.html.
    window.addEventListener('beforeunload', () => window.clearInterval(timer), { once: true });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
