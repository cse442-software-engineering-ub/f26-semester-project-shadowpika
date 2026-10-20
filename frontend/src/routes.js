// The build is deployed under a course subdirectory, so every route and PHP endpoint
// is resolved relative to wherever index.html is being served from.
export const ROUTES = ['admin-register', 'moderator'];

// Static pages kept in these subfolders load the shared navbar, which must still link
// to (and call endpoints in) the site root.
const SUBFOLDERS = ['settings'];

export function currentRoute(location = window.location) {
    const fromHash = location.hash.replace(/^#\/?/, '');
    if (ROUTES.includes(fromHash)) return fromHash;

    const lastSegment = location.pathname.replace(/\/+$/, '').split('/').pop();
    return ROUTES.includes(lastSegment) ? lastSegment : 'login';
}

export function appBase(location = window.location) {
    let path = location.pathname.replace(/[^/]+\.html$/, '');
    for (const route of [...ROUTES, ...SUBFOLDERS]) {
        path = path.replace(new RegExp(`/${route}/?$`), '/');
    }
    return path.endsWith('/') ? path : `${path}/`;
}

// Hash routes work even where the server ignores .htaccess rewrites.
export const pathFor = (route) => appBase() + (route === 'login' ? '' : `#/${route}`);

export const apiUrl = (file) => appBase() + file;
