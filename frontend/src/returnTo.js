// Remembers a shared listing link (item.html?listing_id=N) while a logged-out person logs in or signs up,
// so they land on that listing afterwards. Only this exact shape is ever stored or used, so the stored
// value can never send the browser to another site or page.
export const SHARE_PATH = /^item\.html\?listing_id=[1-9]\d*$/;

export const isSafeSharePath = (path) => typeof path === 'string' && SHARE_PATH.test(path);

const KEY = 'karavan_return_to';

export function clearReturnPath() {
    try {
        window.sessionStorage.removeItem(KEY);
    } catch {
        // Storage can be blocked; the person then simply lands on Home.
    }
}

// Stores the current page when it is a valid item page, otherwise clears any older value.
export function rememberItemPage(location = window.location) {
    const path = location.pathname.endsWith('item.html') ? `item.html${location.search}` : '';
    if (!isSafeSharePath(path)) {
        clearReturnPath();
        return;
    }
    try {
        window.sessionStorage.setItem(KEY, path);
    } catch {
        // See clearReturnPath.
    }
}

// Returns the remembered path once (and forgets it); null when nothing valid is stored.
export function takeReturnPath() {
    let value = null;
    try {
        value = window.sessionStorage.getItem(KEY);
    } catch {
        return null;
    }
    clearReturnPath();
    return isSafeSharePath(value) ? value : null;
}
