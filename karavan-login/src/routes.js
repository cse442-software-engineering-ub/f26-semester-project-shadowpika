// The build is deployed under a course subdirectory, so every route and PHP endpoint
// is resolved relative to wherever index.html is being served from.
export const ROUTES = ['admin-register'];

export function currentRoute(location = window.location) {
    const fromHash = location.hash.replace(/^#\/?/, '');
    if (ROUTES.includes(fromHash)) return fromHash;

    const lastSegment = location.pathname.replace(/\/+$/, '').split('/').pop();
    return ROUTES.includes(lastSegment) ? lastSegment : 'login';
}

export function appBase(location = window.location) {
    let path = location.pathname.replace(/index\.html$/, '');
    for (const route of ROUTES) {
        path = path.replace(new RegExp(`/${route}/?$`), '/');
    }
    return path.endsWith('/') ? path : `${path}/`;
}

// Hash routes work even where the server ignores .htaccess rewrites.
export const pathFor = (route) => appBase() + (route === 'login' ? '' : `#/${route}`);

export const apiUrl = (file) => appBase() + file;
