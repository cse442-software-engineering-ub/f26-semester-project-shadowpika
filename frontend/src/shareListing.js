// Share button (card #158): asks the server for the listing's share path, then copies this site's
// address plus that path. The path is checked before use so a bad answer can never be copied.
import { appBase } from './routes.js';
import { isSafeSharePath } from './returnTo.js';

export const SHARE_ERROR = 'Could not copy the link. Please try again.';

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export async function fetchShareLink(listingId) {
    // LOCAL PREVIEW MODE: `npm run dev` can't run PHP.
    if (isLocalPreview()) {
        return { success: true, listing_id: Number(listingId), share_path: `item.html?listing_id=${Number(listingId)}` };
    }
    const response = await fetch(`./api/get_share_link.php?listing_id=${encodeURIComponent(listingId)}`, { credentials: 'same-origin' });
    return response.json();
}

export const shareUrlFor = (path) => `${window.location.origin}${appBase()}${path}`;

// Resolves to { ok: true } after copying, or { ok: false, message } with text safe to show.
export async function shareListing(listingId, clipboard = navigator.clipboard) {
    try {
        const data = await fetchShareLink(listingId);
        if (data && data.success === true && isSafeSharePath(data.share_path)) {
            await clipboard.writeText(shareUrlFor(data.share_path));
            return { ok: true };
        }
        if (data && data.success === false && typeof data.error === 'string' && data.error.trim()) {
            return { ok: false, message: data.error };
        }
    } catch {
        // Network failure, empty or invalid answer, or a refused clipboard all end here.
    }
    return { ok: false, message: SHARE_ERROR };
}
