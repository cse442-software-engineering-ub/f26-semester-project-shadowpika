// Browser-side memory for the "Join a Community" nav button and the first-login suggestions.
// Every Aptitude team shares this origin, so keys are prefixed.
const NEW_ACCOUNT_KEY = 'karavan_new_account';
const PROMPT_KEY = 'karavan_community_prompt';
const COMMUNITY_KEY = 'karavan_community';

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
    const community = response?.community_id
        ? { community_id: response.community_id, name: response.community_name }
        : null;
    saveJoinedCommunity(community);

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

/** @returns {{community_id: number, name: string} | null} */
export function readJoinedCommunity() {
    try {
        const stored = JSON.parse(read(COMMUNITY_KEY));
        return stored && stored.community_id && stored.name ? stored : null;
    } catch {
        return null;
    }
}

export function saveJoinedCommunity(community) {
    write(COMMUNITY_KEY, community ? JSON.stringify(community) : null);
}
