const initialConversations = [
    {
        id: 1,
        name: "Alex Morgan",
        listing: "Vintage Denim Jacket",
        messages: [
            { from: "them", text: "Hi! Is this still available?" },
            {
                from: "me",
                text: "Yes, it is! Let me know if you're interested."
            }
        ]
    },
    {
        id: 2,
        name: "Jamie Lee",
        listing: "Canvas Backpack",
        messages: [
            { from: "them", text: "Thanks for the offer!" }
        ]
    },
    {
        id: 3,
        name: "Taylor Smith",
        listing: "Running Shoes",
        messages: [
            { from: "them", text: "Where can we meet?" }
        ]
    }
];

const conversations = initialConversations.map(conversation => ({
    ...conversation,
    messages: conversation.messages.map(message => ({ ...message }))
}));

let selectedId = 1;

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
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
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
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

function renderConversationList() {
    const list = document.querySelector(".conversation-list");

    list.innerHTML = `
        <h2>Inbox</h2>
        <div class="conversation-items">
            ${conversations.map(conversation => {
                const lastMessage =
                    conversation.messages[conversation.messages.length - 1];

                return `
                    <button
                        type="button"
                        class="conversation ${
                            selectedId === conversation.id ? "active" : ""
                        }"
                        data-id="${conversation.id}"
                        aria-pressed="${selectedId === conversation.id}">

                        <span class="conversation-avatar">
                            ${escapeHTML(conversation.name.charAt(0))}
                        </span>

                        <span class="conversation-info">
                            <strong>${escapeHTML(conversation.name)}</strong>
                            <span>${escapeHTML(lastMessage?.text || "")}</span>
                            <small>${escapeHTML(conversation.listing)}</small>
                        </span>
                    </button>
                `;
            }).join("")}
        </div>
    `;

    list.querySelectorAll(".conversation").forEach(button => {
        button.addEventListener("click", () => {
            selectedId = Number(button.dataset.id);
            renderConversationList();
            renderChat();
        });
    });
}

function renderChat() {
    const panel = document.querySelector(".chat-panel");
    const selected = conversations.find(
        conversation => conversation.id === selectedId
    );

    if (!selected) {
        panel.innerHTML = "";
        return;
    }

    panel.innerHTML = `
        <header class="chat-header">
            <div>
                <h2>${escapeHTML(selected.name)}</h2>
                <p>${escapeHTML(selected.listing)}</p>
            </div>
        </header>

        <div class="chat-messages" aria-live="polite">
            ${selected.messages.map(message => `
                <div class="message-row ${
                    message.from === "me" ? "sent" : "received"
                }">
                    <p class="message-bubble">
                        ${escapeHTML(message.text)}
                    </p>
                </div>
            `).join("")}
        </div>

        <form class="message-form">
            <input
                type="text"
                name="message"
                placeholder="Write a message..."
                aria-label="Write a message"
                autocomplete="off"
                required>

            <button type="submit" aria-label="Send message">
                <svg viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M22 2 11 13"/>
                    <path d="m22 2-7 20-4-9-9-4 20-7Z"/>
                </svg>
            </button>
        </form>
    `;

    const form = panel.querySelector(".message-form");
    const input = form.querySelector("input");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const text = input.value.trim();
        if (!text) return;

        selected.messages.push({
            from: "me",
            text: text
        });

        renderConversationList();
        renderChat();

        const messageInput = panel.querySelector('input[name="message"]');
        messageInput.focus();
    });

    const messagesContainer = panel.querySelector(".chat-messages");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function initializeMessages() {
    const root = document.getElementById("root");

    root.innerHTML = `
        <main class="messages-page">
            <header class="messages-heading">
                ${MessageIcon()}
                <h1>Messages</h1>
            </header>

            <section class="messages-layout">
                <aside class="conversation-list"></aside>
                <section class="chat-panel"></section>
            </section>
        </main>
    `;

    renderConversationList();
    renderChat();
}

initializeMessages();