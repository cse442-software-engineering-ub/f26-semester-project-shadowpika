// Browser-side memory for the "Join a Community" nav button and the first-login suggestions.
// Every Aptitude team shares this origin, so keys are prefixed.
const NEW_ACCOUNT_KEY = 'karavan_new_account';
const PROMPT_KEY = 'karavan_community_prompt';
const COMMUNITIES_KEY = 'karavan_communities';

// The nav owns the picker; the search page listens so its results follow joins and leaves.
const CHANGED_EVENT = 'karavan:communities-changed';
const OPEN_EVENT = 'karavan:open-communities';

const normalize = (email) => String(email ?? '').trim().toLowerCase();

function read(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key, value) {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch {
        // Private browsing can block storage; the picker still works from the nav button.
    }
}

/** Called when Sign up succeeds, so that account's first login shows the suggestions. */
export function markNewAccount(email) {
    write(NEW_ACCOUNT_KEY, normalize(email));
}

/** Called with login.php's response after every successful login. */
export function recordLogin(email, response) {
    saveJoinedCommunities(Array.isArray(response?.communities) ? response.communities : []);

    if (read(NEW_ACCOUNT_KEY) === normalize(email)) {
        write(NEW_ACCOUNT_KEY, null);
        write(PROMPT_KEY, '1');
    }
}

/** True once, on the first page shown after a new account's first login. */
export function takeCommunityPrompt() {
    const pending = read(PROMPT_KEY) === '1';
    write(PROMPT_KEY, null);
    return pending;
}

/** Communities the user joined (not the automatic campus community). @returns {{community_id: number, name: string}[]} */
export function readJoinedCommunities() {
    try {
        const stored = JSON.parse(read(COMMUNITIES_KEY));
        return Array.isArray(stored) ? stored.filter((c) => c && c.community_id && c.name) : [];
    } catch {
        return [];
    }
}

export function saveJoinedCommunities(communities) {
    write(COMMUNITIES_KEY, communities && communities.length > 0
        ? JSON.stringify(communities.map(({ community_id, name }) => ({ community_id, name })))
        : null);
}

export const announceCommunitiesChanged = () => window.dispatchEvent(new Event(CHANGED_EVENT));
export const openCommunityPicker = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** @returns {() => void} unsubscribe */
export function onCommunitiesChanged(listener) {
    window.addEventListener(CHANGED_EVENT, listener);
    return () => window.removeEventListener(CHANGED_EVENT, listener);
}

/** @returns {() => void} unsubscribe */
export function onOpenCommunityPicker(listener) {
    window.addEventListener(OPEN_EVENT, listener);
    return () => window.removeEventListener(OPEN_EVENT, listener);
}
