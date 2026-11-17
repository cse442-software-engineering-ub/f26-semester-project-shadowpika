/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html?listing_id=92001"}
 */
// Mirrors frontend task card #235 (Purchase Request Count Frontend).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import { loadRequestCountText, requestCountText } from '../requestCount.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav aria-label="Main">Karavan navigation</nav> }));

const LISTING = {
    listing_id: 92001, name: 'Request Count Lamp', price: '20.00', condition: 'Good', image_url: null,
    category: 'Other', community: 'Karavan', description: 'Test lamp.',
};
const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

// `count` is the get_request_count.php answer body (a string, so invalid JSON can be tested).
function stubApi({ count, details = { success: true, listing: LISTING }, owner = false }) {
    const fetchMock = vi.fn((url) => {
        if (url.includes('get_item_details')) return json(details);
        if (url.includes('get_request_count')) return Promise.resolve(new Response(count, { status: 200 }));
        if (url.includes('get_listing_ownership')) return json({ success: true, listing_id: 92001, is_owner: owner });
        if (url.includes('get_my_meeting_requests')) return json({ success: true, requests: [] });
        return json({ success: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}
const answer = (n) => JSON.stringify({ success: true, listing_id: 92001, request_count: n });
const countCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url.includes('get_request_count'));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('Purchase request count (#235)', () => {
    beforeEach(() => window.history.replaceState({}, '', 'item.html?listing_id=92001'));
    afterEach(() => vi.unstubAllGlobals());

    it('Test 1: one GET for the opened listing; 0 and 1 requests show their lines', async () => {
        const fetchMock = stubApi({ count: answer(0) });
        const { unmount } = render(<ItemDetails />);
        expect(await screen.findByText('No purchase requests yet')).toBeInTheDocument();
        expect(countCalls(fetchMock)).toHaveLength(1);
        expect(countCalls(fetchMock)[0]).toEqual(['./api/get_request_count.php?listing_id=92001', { credentials: 'same-origin' }]);
        unmount();

        stubApi({ count: answer(1) });
        render(<ItemDetails />);
        expect(await screen.findByText('1 person has requested this item')).toBeInTheDocument();
        expect(screen.queryByText('No purchase requests yet')).not.toBeInTheDocument();
    });

    it('Test 2: 2 and 12 requests show the number from the server', async () => {
        stubApi({ count: answer(2) });
        const { unmount } = render(<ItemDetails />);
        expect(await screen.findByText('2 people have requested this item')).toBeInTheDocument();
        unmount();

        stubApi({ count: answer(12) });
        render(<ItemDetails />);
        expect(await screen.findByText('12 people have requested this item')).toBeInTheDocument();
    });

    it('Test 3: the owner (no Buy Now) still sees the line', async () => {
        stubApi({ count: answer(3), owner: true });
        render(<ItemDetails />);
        expect(await screen.findByText('3 people have requested this item')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
    });

    it('the line sits between Buy Now and Condition', async () => {
        stubApi({ count: answer(0) });
        render(<ItemDetails />);
        const line = await screen.findByText('No purchase requests yet');
        const buy = await screen.findByRole('button', { name: 'Buy Now' });
        const condition = screen.getByText('Condition');
        expect(buy.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(line.compareDocumentPosition(condition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each([
        ['an error answer', '{"success":false,"error":"Could not load the request count."}'],
        ['an empty answer', ''],
        ['invalid JSON', 'not json'],
        ['a missing count', '{"success":true,"listing_id":92001}'],
        ['a negative number', '{"success":true,"listing_id":92001,"request_count":-1}'],
        ['text', '{"success":true,"listing_id":92001,"request_count":"abc"}'],
        ['a decimal', '{"success":true,"listing_id":92001,"request_count":1.5}'],
    ])('Test 4: %s shows no line and no error text', async (_label, count) => {
        const fetchMock = stubApi({ count });
        render(<ItemDetails />);
        expect(await screen.findByRole('heading', { name: 'Request Count Lamp' })).toBeInTheDocument();
        await waitFor(() => expect(countCalls(fetchMock)).toHaveLength(1));
        await settle();
        expect(document.querySelector('.id-request-count')).toBeNull();
        expect(screen.queryByText(/requested this item|purchase requests/)).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('Test 6: a sold item shows the server message and no line', async () => {
        stubApi({ count: answer(2), details: { success: false, error: 'This item has been sold.' } });
        render(<ItemDetails />);
        expect(await screen.findByText('This item has been sold.')).toBeInTheDocument();
        await settle();
        expect(document.querySelector('.id-request-count')).toBeNull();
    });

    it('text helpers: wording per count, null on a network failure', async () => {
        expect(requestCountText(0)).toBe('No purchase requests yet');
        expect(requestCountText(1)).toBe('1 person has requested this item');
        expect(requestCountText(5)).toBe('5 people have requested this item');
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
        expect(await loadRequestCountText(92001)).toBeNull();
    });
});
