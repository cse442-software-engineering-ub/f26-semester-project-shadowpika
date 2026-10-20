const API_URL = "api/messages.php";
const CONVERSATIONS_URL = "api/conversations.php";

let conversations = [];
let selectedId = null;
let currentUserId = null;
let chatRequestId = 0;

// Escape text before inserting it into HTML.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function MessageIcon() {
    return `
        <svg viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8
                8.5 8.5 0 0 1-7.6 4.7
                8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7
                a8.4 8.4 0 0 1-.9-3.8
                8.5 8.5 0 0 1 4.7-7.6
                8.4 8.4 0 0 1 3.8-.9h.5
                a8.5 8.5 0 0 1 8 8v.5z"/>
        </svg>
    `;
}

// Make API requests and handle invalid JSON/PHP errors.
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `The server returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok || !data.success) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function getSelectedConversation() {
    return conversations.find(
        conversation => conversation.key === selectedId
    );
}

function getConversationKey(userId, listingId) {
    return `${Number(userId)}:${listingId == null ? "null" : Number(listingId)}`;
}

// Load the inbox from conversations.php.
async function loadConversations() {
    const data = await apiRequest(CONVERSATIONS_URL);

    if (data.current_user_id !== undefined) {
        currentUserId = Number(data.current_user_id);
    }

    conversations = data.conversations.map(conversation => {
        const id = Number(conversation.id);

        const listingId = conversation.listing_id == null
            ? null
            : Number(conversation.listing_id);

        return {
            id,
            listingId,
            key: getConversationKey(id, listingId),
            name: conversation.name || "User",
            listing: conversation.listing || "",
            lastMessage: conversation.last_message || "",
            lastTimestamp: conversation.last_timestamp || "",
            messages: []
        };
    });

    renderConversationList();

    if (conversations.length > 0) {
        const stillExists = conversations.some(
            conversation => conversation.key === selectedId
        );

        if (!stillExists) {
            selectedId = conversations[0].key;
        }

        await loadChat(selectedId);
    } else {
        selectedId = null;
        renderChat();
    }
}

// Retrieve messages for the selected user AND listing.
async function loadChat(conversationKey) {
    const conversation = conversations.find(
        item => item.key === conversationKey
    );

    if (!conversation) return;

    // A NULL listing ID represents an older conversation.
    if (conversation.listingId == null) {
        showChatError(
            "This conversation has no listing assigned. " +
            "Please assign a listing to its messages before opening it."
        );
        return;
    }

    const requestId = ++chatRequestId;

    renderChat(true);

    try {
        const url =
            `${API_URL}?with=${encodeURIComponent(conversation.id)}` +
            `&listing_id=${encodeURIComponent(conversation.listingId)}`;

        const data = await apiRequest(url);

        // Ignore responses from a chat that is no longer selected.
        if (
            requestId !== chatRequestId ||
            selectedId !== conversation.key
        ) {
            return;
        }

        if (data.current_user_id !== undefined) {
            currentUserId = Number(data.current_user_id);
        }

        conversation.messages = data.messages.map(message => ({
            senderId: Number(message.sender_id),
            receiverId: Number(message.receiver_id),
            listingId: message.listing_id == null
                ? null
                : Number(message.listing_id),
            position: Number(message.position),
            timestamp: message.timestamp || "",
            text: message.message,
            from: Number(message.sender_id) === currentUserId
                ? "me"
                : "them"
        }));

        const latest = conversation.messages.at(-1);

        if (latest) {
            conversation.lastMessage = latest.text;
            conversation.lastTimestamp = latest.timestamp;
        }

        renderConversationList();
    } catch (error) {
        if (
            requestId === chatRequestId &&
            selectedId === conversation.key
        ) {
            showChatError(error.message);
            return;
        }
    }

    if (
        requestId === chatRequestId &&
        selectedId === conversation.key
    ) {
        renderChat();
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return "";

    // MySQL timestamps are commonly returned as "YYYY-MM-DD HH:MM:SS".
    const normalized = timestamp.includes("T")
        ? timestamp
        : timestamp.replace(" ", "T");

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function renderConversationList() {
    const list = document.querySelector(".conversation-list");
    if (!list) return;

    // Always display the Inbox heading.
    list.innerHTML = `<h2>Inbox</h2>`;

    // Handle the case where the user has no conversations.
    if (conversations.length === 0) {
        list.innerHTML += `
            <div class="empty-conversations">
                <p>No conversations yet.</p>
                <p>Message a seller to start a conversation.</p>
            </div>
        `;
        return;
    }

    // Render existing conversations.
    list.innerHTML += `
        <div class="conversation-items">
            ${conversations.map(conversation => {
                const lastMessage =
                    conversation.messages.at(-1)?.text ??
                    conversation.lastMessage;

                const timestamp =
                    conversation.messages.at(-1)?.timestamp ||
                    conversation.lastTimestamp;

                return `
                    <button
                        type="button"
                        class="conversation ${
                            selectedId === conversation.key ? "active" : ""
                        }"
                        data-key="${escapeHTML(conversation.key)}"
                        aria-pressed="${selectedId === conversation.key}">

                        <span class="conversation-avatar">
                            ${escapeHTML(
                                conversation.name.charAt(0).toUpperCase()
                            )}
                        </span>

                        <span class="conversation-info">
                            <strong>${escapeHTML(conversation.name)}</strong>
                            <span>${escapeHTML(lastMessage)}</span>
                            <small>${escapeHTML(conversation.listing)}</small>
                            ${
                                timestamp
                                    ? `<time>${escapeHTML(
                                        formatTimestamp(timestamp)
                                    )}</time>`
                                    : ""
                            }
                        </span>
                    </button>
                `;
            }).join("")}
        </div>
    `;

    list.querySelectorAll(".conversation").forEach(button => {
        button.addEventListener("click", async () => {
            const key = button.dataset.key;

            if (key === selectedId) return;

            selectedId = key;
            renderConversationList();
            await loadChat(key);
        });
    });
}

function renderChat(loading = false) {
    const panel = document.querySelector(".chat-panel");
    if (!panel) return;

    const selected = getSelectedConversation();

    if (!selected) {
        panel.innerHTML = `
            <div class="empty-chat">
                <p>Select a conversation to start messaging.</p>
            </div>
        `;
        return;
    }

    const messagesHTML = selected.messages.map(message => `
        <div class="message-row ${
            message.from === "me" ? "sent" : "received"
        }">
            <p class="message-bubble">${escapeHTML(message.text)}</p>
            ${
                message.timestamp
                    ? `<time class="message-time">${escapeHTML(
                        formatTimestamp(message.timestamp)
                    )}</time>`
                    : ""
            }
        </div>
    `).join("");

    panel.innerHTML = `
        <header class="chat-header">
            <div>
                <h2>${escapeHTML(selected.name)}</h2>
                <p>${escapeHTML(selected.listing)}</p>
            </div>
        </header>

        <div class="chat-messages" aria-live="polite">
            ${loading && selected.messages.length === 0
                ? `<p class="chat-loading">Loading messages...</p>`
                : messagesHTML}
        </div>

        <form class="message-form">
            <input
                type="text"
                name="message"
                placeholder="Write a message..."
                aria-label="Write a message"
                autocomplete="off"
                maxlength="5000"
                required
                ${loading ? "disabled" : ""}>

            <button
                type="submit"
                aria-label="Send message"
                ${loading ? "disabled" : ""}>
                <svg viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    stroke-width="1.8" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13"/>
                    <path d="m22 2-7 20-4-9-9-4 20-7Z"/>
                </svg>
            </button>
        </form>

        <p class="message-error" role="alert"></p>
    `;

    const messagesContainer = panel.querySelector(".chat-messages");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const form = panel.querySelector(".message-form");
    const input = form.querySelector('input[name="message"]');

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const text = input.value.trim();
        if (!text || loading) return;

        if (selected.listingId == null) {
            panel.querySelector(".message-error").textContent =
                "This conversation needs a listing assigned before you can reply.";
            return;
        }

        const sendButton = form.querySelector('button[type="submit"]');
        const errorElement = panel.querySelector(".message-error");

        sendButton.disabled = true;
        input.disabled = true;
        errorElement.textContent = "";

        try {
            const data = await apiRequest(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    receiver_id: selected.id,
                    listing_id: selected.listingId,
                    message: text
                })
            });

            // Don't update a different conversation if the user switched
            // chats while the request was being processed.
            const saved = data.message;

            selected.messages.push({
                senderId: Number(saved.sender_id),
                receiverId: Number(saved.receiver_id),
                listingId: saved.listing_id == null
                    ? null
                    : Number(saved.listing_id),
                position: Number(saved.position),
                timestamp: saved.timestamp || "",
                text: saved.message,
                from: "me"
            });

            selected.lastMessage = saved.message;
            selected.lastTimestamp = saved.timestamp || "";

            // Re-sort locally by timestamp so the latest conversation
            // moves to the top immediately.
            conversations.sort((a, b) => {
                const timeA = new Date(
                    (a.lastTimestamp || "").replace(" ", "T")
                ).getTime() || 0;

                const timeB = new Date(
                    (b.lastTimestamp || "").replace(" ", "T")
                ).getTime() || 0;

                return timeB - timeA;
            });

            renderConversationList();

            if (selectedId === selected.key) {
                renderChat();

                document.querySelector(
                    ".chat-panel input[name='message']"
                )?.focus();
            }
        } catch (error) {
            errorElement.textContent = error.message;
            sendButton.disabled = false;
            input.disabled = false;
            input.focus();
        }
    });
}

function showChatError(message) {
    const panel = document.querySelector(".chat-panel");

    if (!panel) return;

    panel.innerHTML = `
        <p class="message-error" role="alert">
            ${escapeHTML(message)}
        </p>

        <button type="button" class="retry-messages">
            Try again
        </button>
    `;

    panel.querySelector(".retry-messages")
        .addEventListener("click", () => loadChat(selectedId));
}

function initializeMessages() {
    const root = document.getElementById("message-root");

    if (!root) {
        console.error('Missing element with id="message-root".');
        return;
    }

    root.innerHTML = `
        <main class="messages-page">
            <header class="messages-heading">
                ${MessageIcon()}
                <h1>Messages</h1>
            </header>

            <section class="messages-layout">
                <aside class="conversation-list">
                    <p>Loading inbox...</p>
                </aside>

                <section class="chat-panel"></section>
            </section>
        </main>
    `;

    loadConversations().catch(error => {
        const list = document.querySelector(".conversation-list");

        list.innerHTML = `
            <h2>Inbox</h2>
            <p class="message-error" role="alert">
                ${escapeHTML(error.message)}
            </p>

            <button type="button" class="retry-inbox">
                Try again
            </button>
        `;

        list.querySelector(".retry-inbox")
            .addEventListener("click", initializeMessages);
    });
}

initializeMessages();