// Messages (cards #12, #97): calls to api/message.php and api/conversations.php.
export const MESSAGE_MAX_LENGTH = 5000;

export const messagePageUrl = (sellerId, listingId) =>
    `./message.html?${new URLSearchParams({ with: String(sellerId), listing_id: String(listingId) })}`;

export async function fetchConversations() {
    const response = await fetch('./api/conversations.php', { credentials: 'same-origin', cache: 'no-store' });
    return response.json();
}

export async function fetchConversation(otherUserId, listingId) {
    const query = new URLSearchParams({ with: String(otherUserId), listing_id: String(listingId) });
    const response = await fetch(`./api/message.php?${query}`, { credentials: 'same-origin', cache: 'no-store' });
    return response.json();
}

export async function sendMessage(receiverId, listingId, message) {
    const response = await fetch('./api/message.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ receiver_id: Number(receiverId), listing_id: Number(listingId), message }),
    });
    return response.json();
}

const timeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatMessageTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date);
}
