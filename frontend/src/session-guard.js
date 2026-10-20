import { apiUrl } from './routes.js';
import { hasAuthCookie, navigateTo } from './session.js';

// Retains the deployed wrappers' UI guard. PHP remains the authorization boundary.
// Dev mode allows frontend work with mocked APIs, independently of login/backend.
if (import.meta.env.PROD) {
    const check = () => {
        if (!hasAuthCookie()) navigateTo(apiUrl('404.html'));
    };
    check();
    const timer = window.setInterval(check, 1000);
    // Stop as soon as the page starts leaving: after Log Out the cookie is already gone
    // while the login page loads, and a late check would send the browser to 404.html.
    window.addEventListener('beforeunload', () => window.clearInterval(timer), { once: true });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
