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
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
}
