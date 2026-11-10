/**
 * @vitest-environment jsdom
 */
// Frontend task card #97 (Messages frontend) and user story #12 (message the seller).
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Messages from '../Messages.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const ME = 41;
const SELLER = 217;
const CONVERSATION = {
    success: true, current_user_id: ME, other_user_id: SELLER, other_username: 'morgan.keller1',
    listing_id: 95023, listing_name: 'Messaging Test Desk Lamp',
    messages: [
        { sender_id: ME, receiver_id: SELLER, message: 'Is the lamp available?', position: 1, timestamp: '2026-11-03T15:00:00Z' },
        { sender_id: SELLER, receiver_id: ME, message: 'Yes it is.', position: 2, timestamp: '2026-11-03T15:01:00Z' },
    ],
};
const INBOX = {
    success: true, current_user_id: ME,
    conversations: [{
        other_user_id: SELLER, other_username: 'morgan.keller1', listing_id: 95023,
        listing_name: 'Messaging Test Desk Lamp', last_message: 'Yes it is.', last_sender_id: SELLER,
        last_timestamp: '2026-11-03T15:01:00Z',
    }],
};

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
}));

function mockBackend({ conversation = CONVERSATION, inbox = INBOX, send } = {}) {
    const fetchMock = vi.fn((url, options = {}) => {
        if (url.startsWith('./api/conversations.php')) return json(inbox);
        if (options.method === 'POST') return send ? send(JSON.parse(options.body)) : json({ success: false, error: 'Unexpected' }, 500);
        return json(conversation);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const posts = (fetchMock) => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');

describe('Messages page (#97)', () => {
    beforeEach(() => window.history.replaceState({}, '', `/message.html?with=${SELLER}&listing_id=95023`));
    afterEach(() => vi.unstubAllGlobals());

    it('opens the conversation named in the address with the seller and listing', async () => {
        const fetchMock = mockBackend();
        render(<Messages />);

        expect(await screen.findByRole('heading', { name: 'morgan.keller1' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'About: Messaging Test Desk Lamp' })).toHaveAttribute('href', './item.html?listing_id=95023');
        const list = screen.getByRole('list', { name: 'Messages with morgan.keller1' });
        expect(within(list).getAllByRole('listitem').map((item) => item.querySelector('.msg-text')?.textContent).filter(Boolean))
            .toEqual(['Is the lamp available?', 'Yes it is.']);
        expect(fetchMock).toHaveBeenCalledWith(`./api/message.php?with=${SELLER}&listing_id=95023`, expect.anything());
    });

    it('sends a trimmed message, shows it, and clears the box', async () => {
        const fetchMock = mockBackend({
            conversation: { ...CONVERSATION, messages: [] },
            send: (body) => json({ success: true, message: {
                sender_id: ME, receiver_id: SELLER, message: body.message, position: 1, timestamp: '2026-11-03T16:00:00Z',
            } }, 201),
        });
        render(<Messages />);

        const box = await screen.findByLabelText('Message morgan.keller1');
        fireEvent.change(box, { target: { value: '  Can we meet at Capen?  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(await screen.findByText('Can we meet at Capen?')).toBeInTheDocument();
        expect(box).toHaveValue('');
        expect(JSON.parse(posts(fetchMock)[0][1].body)).toEqual({ receiver_id: SELLER, listing_id: 95023, message: 'Can we meet at Capen?' });
    });

    it('blocks empty and whitespace-only messages without calling the server', async () => {
        const fetchMock = mockBackend();
        render(<Messages />);

        const box = await screen.findByLabelText('Message morgan.keller1');
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Type a message before sending.');
        fireEvent.change(box, { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Type a message before sending.');
        expect(posts(fetchMock)).toHaveLength(0);
    });

    it('limits the box to 5000 characters', async () => {
        mockBackend();
        render(<Messages />);
        expect(await screen.findByLabelText('Message morgan.keller1')).toHaveAttribute('maxLength', '5000');
    });

    it('disables sending while a message is in flight so it is sent once', async () => {
        let finish;
        const fetchMock = mockBackend({ send: () => new Promise((resolve) => { finish = resolve; }) });
        render(<Messages />);

        const box = await screen.findByLabelText('Message morgan.keller1');
        fireEvent.change(box, { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        const sending = screen.getByRole('button', { name: 'Sending...' });
        expect(sending).toBeDisabled();
        expect(box).toBeDisabled();
        fireEvent.click(sending);
        expect(posts(fetchMock)).toHaveLength(1);

        finish(new Response(JSON.stringify({ success: true, message: {
            sender_id: ME, receiver_id: SELLER, message: 'Hello', position: 3, timestamp: '2026-11-03T16:00:00Z',
        } }), { status: 201 }));
        expect(await screen.findByRole('button', { name: 'Send' })).toBeEnabled();
    });

    it('keeps the typed message and shows the server error when sending fails', async () => {
        mockBackend({ send: () => json({ success: false, error: 'This item is only available to members of its community.' }, 403) });
        render(<Messages />);

        const box = await screen.findByLabelText('Message morgan.keller1');
        fireEvent.change(box, { target: { value: 'Still available?' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('This item is only available to members of its community.');
        expect(box).toHaveValue('Still available?');
    });

    it('lists conversations and opens one when clicked', async () => {
        window.history.replaceState({}, '', '/message.html');
        mockBackend();
        render(<Messages />);

        expect(screen.getByText('Choose a conversation to read it.')).toBeInTheDocument();
        const entry = await screen.findByRole('button', { name: /morgan\.keller1/ });
        expect(entry).toHaveTextContent('Messaging Test Desk Lamp');
        expect(entry).toHaveTextContent('Yes it is.');
        fireEvent.click(entry);
        expect(await screen.findByRole('heading', { name: 'morgan.keller1' })).toBeInTheDocument();
        expect(window.location.search).toBe(`?with=${SELLER}&listing_id=95023`);
    });

    it('shows an empty inbox message', async () => {
        window.history.replaceState({}, '', '/message.html');
        mockBackend({ inbox: { success: true, current_user_id: ME, conversations: [] } });
        render(<Messages />);
        expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument();
    });

    it('shows the server error when the conversation cannot be opened', async () => {
        mockBackend({ conversation: { success: false, error: 'This listing is not associated with either participant.' } });
        render(<Messages />);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This listing is not associated with either participant.'));
        expect(screen.queryByLabelText('Message morgan.keller1')).not.toBeInTheDocument();
    });
});
