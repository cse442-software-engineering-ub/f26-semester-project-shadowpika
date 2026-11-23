/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/home.html"}
 */
// Mirrors frontend task card #238 (Remove Denied Request Frontend), using the same payloads.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '../Home.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

// Answers each endpoint by file name, like a DevTools override per request.
function serve(routes) {
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((file) => String(url).includes(file));
        return match ? routes[match]() : Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const others = {
    'get_incoming_meeting_requests.php': () => json(200, { success: true, requests: [] }),
    'get_recommended_items.php': () => json(200, { success: true, items: [] }),
    'get_previously_viewed_items.php': () => json(200, { success: true, items: [] }),
};

const callsTo = (fetchMock, file) => fetchMock.mock.calls.filter(([url]) => String(url).includes(file));

const make = (id, status, overrides = {}) => ({
    request_id: id, listing_id: 91000, name: `Item ${id}`, price: '12.00',
    meeting_date: '2026-12-08', meeting_time: '14:30', location: 'Capen Hall Main Entrance', status,
    checked_in_at: null, seller_checked_in_at: null, listing_status: 'active', ...overrides,
});

const deniedOne = make(99921, 'denied');
const deniedTwo = make(99922, 'denied');
const pending = make(99923, 'pending', { listing_id: 91001 });

const mine = (requests) => ({ ...others, 'get_my_meeting_requests.php': () => json(200, { success: true, requests }) });
const removeButtons = () => screen.getAllByRole('button', { name: 'Remove' });
const homePath = '/CSE442/2026-Fall/cse-442j/davidjob/home.html';

afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', homePath);
});

describe('Frontend: Remove Denied Request (#238)', () => {
    it('shows Remove only on denied requests, and keeps Cancel Request on pending ones', async () => {
        serve(mine([pending, make(99924, 'approved'), deniedOne, make(99925, 'location_change_requested')]));
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99923' });
        expect(removeButtons()).toHaveLength(1);
        expect(removeButtons()[0].closest('li')).toHaveTextContent('Item 99921');
        expect(screen.getAllByRole('button', { name: 'Cancel Request' })).toHaveLength(1);
    });

    it('removes only the clicked denied request and confirms it', async () => {
        const fetchMock = serve({
            ...mine([deniedOne, deniedTwo]),
            'remove_denied_request.php': () => json(200, { success: true }),
        });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99921' });
        fireEvent.click(removeButtons()[0]);

        expect(await screen.findByText('The denied request was removed.')).toBeVisible();
        const posts = callsTo(fetchMock, 'remove_denied_request.php');
        expect(posts).toHaveLength(1);
        expect(posts[0][0]).toBe('./api/remove_denied_request.php');
        expect(posts[0][1].method).toBe('POST');
        expect(posts[0][1].body).toBe('{"request_id":99921}');
        expect(screen.queryByRole('heading', { name: 'Item 99921' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Item 99922' })).toBeVisible();
        expect(removeButtons()).toHaveLength(1);
    });

    it("shows the server's error and keeps the request with its Remove button", async () => {
        serve({
            ...mine([deniedOne]),
            'remove_denied_request.php': () => json(409, { success: false, error: 'Only denied requests can be removed.' }),
        });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99921' });
        fireEvent.click(removeButtons()[0]);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Only denied requests can be removed.');
        expect(alert).toHaveClass('id-error');
        expect(screen.queryByText('The denied request was removed.')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Item 99921' })).toBeVisible();
        await waitFor(() => expect(removeButtons()).toHaveLength(1));
    });

    it.each([
        ['a rejected request', () => Promise.reject(new TypeError('Failed to fetch'))],
        ['an answer that is not JSON', () => Promise.resolve(new Response('not json', { status: 200 }))],
    ])('shows a connection error and keeps the request after %s', async (_label, answer) => {
        serve({ ...mine([deniedOne]), 'remove_denied_request.php': answer });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99921' });
        fireEvent.click(removeButtons()[0]);

        expect(await screen.findByText('Could not connect to the server.')).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Item 99921' })).toBeVisible();
        await waitFor(() => expect(removeButtons()).toHaveLength(1));
    });

    it('shows the sent notice from the address and drops it from the address', async () => {
        window.history.replaceState({}, '', `${homePath}?request_sent=1`);
        const replaceState = vi.spyOn(window.history, 'replaceState');
        serve(mine([pending]));
        render(<Home />);

        expect(await screen.findByText('Your meeting request was sent.')).toBeVisible();
        expect(replaceState).toHaveBeenCalled();
        expect(window.location.search).toBe('');
        replaceState.mockRestore();
    });

    it('shows no sent notice without the flag in the address', async () => {
        serve(mine([pending]));
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99923' });
        expect(screen.queryByText('Your meeting request was sent.')).not.toBeInTheDocument();
    });
});
