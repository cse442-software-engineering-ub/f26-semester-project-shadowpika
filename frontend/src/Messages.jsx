import React, { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './Messages.css';
import { MESSAGE_MAX_LENGTH, fetchConversation, fetchConversations, formatMessageTime, sendMessage } from './messages.js';
const REFRESH_MS = 5000;
const EMPTY_MESSAGE_ERROR = 'Type a message before sending.';

function chatFromAddress() {
    const params = new URLSearchParams(window.location.search);
    const other = params.get('with');
    const listing = params.get('listing_id');
    return other && listing ? { otherUserId: other, listingId: listing } : null;
}

const sameChat = (a, b) => a && b && String(a.otherUserId) === String(b.otherUserId) && String(a.listingId) === String(b.listingId);

function Inbox({ conversations, status, error, selected, onSelect }) {
    return (
        <section className="msg-inbox" aria-labelledby="msg-inbox-title">
            <h1 id="msg-inbox-title" className="msg-title">Messages</h1>
            {status === 'loading' && <p className="msg-note">Loading conversations...</p>}
            {status === 'error' && <p className="msg-error" role="alert">{error}</p>}
            {status === 'done' && conversations.length === 0 && (
                <p className="msg-note">No conversations yet. Open an item and choose Message Seller to start one.</p>
            )}
            {conversations.length > 0 && (
                <ul className="msg-conversations">
                    {conversations.map((conversation) => {
                        const chat = { otherUserId: conversation.other_user_id, listingId: conversation.listing_id };
                        return (
                            <li key={`${conversation.other_user_id}-${conversation.listing_id}`}>
                                <button
                                    type="button"
                                    className={`msg-conversation${sameChat(chat, selected) ? ' is-selected' : ''}`}
                                    aria-current={sameChat(chat, selected) ? 'true' : undefined}
                                    onClick={() => onSelect(chat)}
                                >
                                    <span className="msg-conversation-name">{conversation.other_username}</span>
                                    <span className="msg-conversation-listing">{conversation.listing_name}</span>
                                    <span className="msg-conversation-last">{conversation.last_message}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function Thread({ chat, onBack, onSent }) {
    const [thread, setThread] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const endRef = useRef(null);

    const load = useCallback(async (quiet = false) => {
        try {
            const data = await fetchConversation(chat.otherUserId, chat.listingId);
            if (data.success) {
                setThread(data);
                setStatus('done');
            } else if (!quiet) {
                setError(data.error || 'This conversation could not be loaded.');
                setStatus('error');
            }
        } catch {
            if (!quiet) {
                setError('Could not connect to the server.');
                setStatus('error');
            }
        }
    }, [chat.otherUserId, chat.listingId]);

    useEffect(() => {
        setStatus('loading');
        setThread(null);
        setDraft('');
        setSendError('');
        load();
        const timer = window.setInterval(() => load(true), REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [load]);

    const count = thread?.messages.length ?? 0;
    useEffect(() => {
        endRef.current?.scrollIntoView?.({ block: 'end' });
    }, [count]);

    const handleSend = async (event) => {
        event.preventDefault();
        if (sending) return;
        const message = draft.trim();
        if (message === '') {
            setSendError(EMPTY_MESSAGE_ERROR);
            return;
        }
        setSending(true);
        setSendError('');
        try {
            const data = await sendMessage(chat.otherUserId, chat.listingId, message);
            if (data.success) {
                setDraft('');
                setThread((current) => ({ ...current, messages: [...current.messages, data.message] }));
                onSent();
            } else {
                setSendError(data.error || 'Your message could not be sent.');
            }
        } catch {
            setSendError('Could not connect to the server. Your message was not sent.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) handleSend(event);
    };

    return (
        <section className="msg-thread" aria-label="Conversation">
            <button type="button" className="msg-back" onClick={onBack}>
                <span aria-hidden="true">←</span> All messages
            </button>
            {status === 'loading' && <p className="msg-note">Loading conversation...</p>}
            {status === 'error' && <p className="msg-error" role="alert">{error}</p>}
            {status === 'done' && thread && (
                <>
                    <header className="msg-thread-header">
                        <h2 className="msg-thread-name">{thread.other_username}</h2>
                        <a className="msg-thread-listing" href={`./item.html?listing_id=${encodeURIComponent(thread.listing_id)}`}>
                            About: {thread.listing_name}
                        </a>
                    </header>
                    <ol className="msg-list" aria-label={`Messages with ${thread.other_username}`}>
                        {thread.messages.length === 0 && (
                            <li className="msg-note">Ask {thread.other_username} about {thread.listing_name}.</li>
                        )}
                        {thread.messages.map((message) => {
                            const mine = message.sender_id === thread.current_user_id;
                            return (
                                <li key={message.position} className={`msg-bubble${mine ? ' is-mine' : ''}`}>
                                    <span className="msg-sender">{mine ? 'You' : thread.other_username}</span>
                                    <p className="msg-text">{message.message}</p>
                                    <time className="msg-time" dateTime={message.timestamp}>{formatMessageTime(message.timestamp)}</time>
                                </li>
                            );
                        })}
                        <li ref={endRef} aria-hidden="true" className="msg-end" />
                    </ol>
                    <form className="msg-form" onSubmit={handleSend} noValidate>
                        <label className="msg-label" htmlFor="msg-input">Message {thread.other_username}</label>
                        <textarea
                            id="msg-input"
                            className="msg-input"
                            rows={2}
                            maxLength={MESSAGE_MAX_LENGTH}
                            value={draft}
                            disabled={sending}
                            placeholder="Type a message"
                            onChange={(event) => {
                                setDraft(event.target.value);
                                if (sendError) setSendError('');
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        <button type="submit" className="msg-send" disabled={sending}>
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                        <p className="msg-count" aria-live="polite">{draft.length}/{MESSAGE_MAX_LENGTH}</p>
                        {sendError && <p className="msg-error" role="alert">{sendError}</p>}
                    </form>
                </>
            )}
        </section>
    );
}

export default function Messages() {
    const [conversations, setConversations] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(chatFromAddress);

    const loadConversations = useCallback(async () => {
        try {
            const data = await fetchConversations();
            if (data.success) {
                setConversations(data.conversations);
                setStatus('done');
            } else {
                setError(data.error || 'Your conversations could not be loaded.');
                setStatus('error');
            }
        } catch {
            setError('Could not connect to the server.');
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        loadConversations();
        const timer = window.setInterval(loadConversations, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [loadConversations]);

    const select = (chat) => {
        setSelected(chat);
        const query = chat ? `?${new URLSearchParams({ with: String(chat.otherUserId), listing_id: String(chat.listingId) })}` : '';
        window.history.replaceState({}, '', `${window.location.pathname}${query}`);
    };

    return (
        <div className="ps-page">
            <NavBar />
            <main className={`ps-frame msg-frame${selected ? ' has-thread' : ''}`}>
                <Inbox conversations={conversations} status={status} error={error} selected={selected} onSelect={select} />
                {selected
                    ? <Thread key={`${selected.otherUserId}-${selected.listingId}`} chat={selected} onBack={() => select(null)} onSent={loadConversations} />
                    : <section className="msg-thread msg-thread-empty"><p className="msg-note">Choose a conversation to read it.</p></section>}
            </main>
        </div>
    );
}
