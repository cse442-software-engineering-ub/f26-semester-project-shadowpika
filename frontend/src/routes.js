// The build is deployed under a course subdirectory, so every route and PHP endpoint
// is resolved relative to wherever index.html is being served from.
export const ROUTES = ['admin-register', 'moderator'];

export function currentRoute(location = window.location) {
    const fromHash = location.hash.replace(/^#\/?/, '');
    if (ROUTES.includes(fromHash)) return fromHash;

    const lastSegment = location.pathname.replace(/\/+$/, '').split('/').pop();
    return ROUTES.includes(lastSegment) ? lastSegment : 'login';
}

export function appBase(location = window.location) {
    // Legacy account/password pages remain under settings/ in the release.
    // Navigation and shared APIs must still resolve from the application root.
    let path = location.pathname.replace(/\/settings\/[^/]+\.html$/, '/');
    path = path.replace(/[^/]+\.html$/, '');
    for (const route of ROUTES) {
        path = path.replace(new RegExp(`/${route}/?$`), '/');
    }
    return path.endsWith('/') ? path : `${path}/`;
}

// Hash routes work even where the server ignores .htaccess rewrites.
export const pathFor = (route) => appBase() + (route === 'login' ? '' : `#/${route}`);

export const apiUrl = (file) => appBase() + file;
