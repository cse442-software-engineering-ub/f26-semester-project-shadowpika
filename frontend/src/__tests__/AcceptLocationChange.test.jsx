/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/index.html"}
 */
// Mirrors frontend task card #220 (Accept Location Change Request Frontend), using the same payloads.
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
    request_id: id, listing_id: id + 1000, name: `Item ${id}`, price: '12.00',
    meeting_date: '2026-12-08', meeting_time: '14:30', location: 'Capen Hall Main Entrance', status,
    checked_in_at: null, seller_checked_in_at: null, listing_status: 'active', ...overrides,
});

const changed = make(99901, 'location_change_requested', { location: 'Student Union Main Entrance' });
const pending = make(99902, 'pending');

const acceptButton = () => screen.getByRole('button', { name: 'Accept New Location' });

afterEach(() => vi.unstubAllGlobals());

describe('Frontend: Accept Location Change Request (#220)', () => {
    it('shows Accept New Location only for location_change_requested, Cancel Request only for pending', async () => {
        serve({ ...others, 'get_my_meeting_requests.php': () => json(200, {
            success: true,
            requests: [pending, make(99903, 'approved'), make(99904, 'denied'), changed],
        }) });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99902' });
        expect(screen.getAllByRole('button', { name: 'Accept New Location' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: 'Cancel Request' })).toHaveLength(1);
        expect(acceptButton().closest('li')).toHaveTextContent('Item 99901');
    });

    it('sends one POST with the request ID and shows the approved request', async () => {
        const fetchMock = serve({
            ...others,
            'get_my_meeting_requests.php': () => json(200, { success: true, requests: [changed, pending] }),
            'accept_location_change.php': () => json(200, { success: true, request: { ...changed, status: 'approved' } }),
        });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99901' });
        fireEvent.click(acceptButton());
        expect(await screen.findByText('You accepted the new meeting location.')).toBeVisible();
        const posts = callsTo(fetchMock, 'accept_location_change.php');
        expect(posts).toHaveLength(1);
        expect(posts[0][0]).toBe('./api/accept_location_change.php');
        expect(posts[0][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
        expect(posts[0][1].body).toBe('{"request_id":99901}');
        const card = screen.getByRole('heading', { name: 'Item 99901' }).closest('li');
        expect(card).toHaveTextContent('Approved');
        expect(card).toHaveTextContent('Student Union Main Entrance');
        expect(screen.queryByRole('button', { name: 'Accept New Location' })).toBeNull();
        const other = screen.getByRole('heading', { name: 'Item 99902' }).closest('li');
        expect(other).toHaveTextContent('Pending');
        expect(other).toHaveTextContent('Capen Hall Main Entrance');
    });

    it('shows the server error in orange-red and keeps the request unchanged', async () => {
        serve({
            ...others,
            'get_my_meeting_requests.php': () => json(200, { success: true, requests: [changed] }),
            'accept_location_change.php': () => json(200, { success: false, error: 'This item is no longer available.' }),
        });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99901' });
        fireEvent.click(acceptButton());
        const error = await screen.findByText('This item is no longer available.');
        expect(error).toHaveClass('id-error');
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Item 99901' }).closest('li')).toHaveTextContent('Location Change Requested'));
        expect(acceptButton()).toBeVisible();
    });

    it.each([
        ['the request fails', () => Promise.reject(new TypeError('Failed to fetch'))],
        ['the body is empty', () => Promise.resolve(new Response('', { status: 200 }))],
    ])('shows a connection error when %s and keeps the request', async (_name, answer) => {
        serve({
            ...others,
            'get_my_meeting_requests.php': () => json(200, { success: true, requests: [changed] }),
            'accept_location_change.php': answer,
        });
        render(<Home />);
        await screen.findByRole('heading', { name: 'Item 99901' });
        fireEvent.click(acceptButton());
        const error = await screen.findByText('Could not connect to the server.');
        expect(error).toHaveClass('id-error');
        await waitFor(() => expect(screen.getByRole('heading', { name: 'Item 99901' }).closest('li')).toHaveTextContent('Location Change Requested'));
        expect(acceptButton()).toBeVisible();
    });
});
