/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/home.html"}
 */
// Mirrors frontend task card #217 (Previously Viewed Items Frontend), using the same payloads.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from '../Home.jsx';
import ItemDetails from '../ItemDetails.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

// Answers each endpoint by file name, like a DevTools override per request.
function serve(previouslyViewed, extra = {}) {
    const routes = {
        'get_previously_viewed_items.php': previouslyViewed,
        'get_recommended_items.php': () => json(200, { success: true, items: [{ listing_id: 91002, name: 'Recommended Sample', price: '5.00', image_url: null }] }),
        'get_incoming_meeting_requests.php': () => json(200, { success: true, requests: [] }),
        'get_my_meeting_requests.php': () => json(200, {
            success: true,
            requests: [{ listing_id: 91001, name: 'Calculus Textbook', price: '35.00', image_url: null, meeting_date: '2027-01-03', meeting_time: '09:05', location: 'Capen Hall Main Entrance', status: 'approved' }],
        }),
        ...extra,
    };
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((file) => String(url).includes(file));
        return match ? routes[match]() : Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const three = {
    success: true,
    items: [
        { listing_id: 91005, name: 'Physical Chemistry', price: '60.00', image_url: 'uploads/physical-chemistry.jpg' },
        { listing_id: 91001, name: 'Calculus Textbook', price: '35.00', image_url: 'uploads/calculus-textbook.jpg' },
        { listing_id: 91003, name: 'Desk Lamp', price: '15.00', image_url: null },
    ],
};

describe('Previously Viewed on Home (card #217)', () => {
    it('Test 1: requests once and shows each item in order with cover, name, and price, between Recommended Items and My Purchase Requests', async () => {
        const fetchMock = serve(() => json(200, three));
        const { container } = render(<Home />);

        expect(await screen.findByText('Physical Chemistry')).toBeInTheDocument();
        const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes('get_previously_viewed_items.php'));
        expect(calls).toHaveLength(1);

        const section = container.querySelector('[aria-labelledby="pv-title"]');
        const cards = [...section.querySelectorAll('.ri-row li')];
        expect(cards.map((li) => li.textContent)).toEqual([
            expect.stringContaining('Physical Chemistry$60.00'),
            expect.stringContaining('Calculus Textbook$35.00'),
            expect.stringContaining('Desk Lamp$15.00'),
        ]);
        expect(cards[0].querySelector('img')).toHaveAttribute('src', 'uploads/physical-chemistry.jpg');
        expect(cards[1].querySelector('img')).toHaveAttribute('src', 'uploads/calculus-textbook.jpg');
        expect(cards[2].querySelector('img')).toBeNull();
        expect(cards[2].querySelector('.ps-book-placeholder')).not.toBeNull();

        expect(screen.getByRole('heading', { name: 'Previously Viewed' })).toHaveClass('mr-section-title');
        const headings = screen.getAllByRole('heading').map((h) => h.textContent);
        expect(headings.indexOf('Recommended Items')).toBeLessThan(headings.indexOf('Previously Viewed'));
        expect(headings.indexOf('Previously Viewed')).toBeLessThan(headings.indexOf('My Purchase Requests'));
    });

    it('Test 2: puts 15 items in one row, in order', async () => {
        const items = Array.from({ length: 15 }, (_, i) => {
            const n = String(i + 1).padStart(2, '0');
            return { listing_id: 91801 + i, name: `Previously Viewed Test Item ${n}`, price: `${i + 1}.00`, image_url: null };
        });
        serve(() => json(200, { success: true, items }));
        const { container } = render(<Home />);

        expect(await screen.findByRole('link', { name: /Previously Viewed Test Item 01/ })).toBeInTheDocument();
        const rows = container.querySelectorAll('[aria-labelledby="pv-title"] ul.ri-row');
        expect(rows).toHaveLength(1);
        const names = [...rows[0].querySelectorAll('.ri-name')].map((el) => el.textContent);
        expect(names).toEqual(items.map((item) => item.name));
        expect(rows[0].querySelectorAll('.ri-price')[14]).toHaveTextContent('$15.00');
    });

    it('Test 3: each item links to its details page', async () => {
        serve(() => json(200, three));
        render(<Home />);

        const link = (await screen.findByText('Physical Chemistry')).closest('a');
        expect(link.getAttribute('href')).toMatch(/item\.html\?listing_id=91005$/);
    });

    it('Test 4: shows the empty message and no items', async () => {
        serve(() => json(200, { success: true, items: [] }));
        const { container } = render(<Home />);

        expect(await screen.findByText('No previously viewed items yet.')).toBeInTheDocument();
        expect(container.querySelector('[aria-labelledby="pv-title"] .ri-row')).toBeNull();
    });

    it("Test 5: shows the server's error, then the connection error, while the rest of Home still loads", async () => {
        serve(() => json(200, { success: false, error: 'Server error.' }));
        const first = render(<Home />);

        expect(await screen.findByText('Server error.')).toHaveClass('id-error');
        expect(first.container.querySelector('[aria-labelledby="pv-title"] .ri-row')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Recommended Items' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My Purchase Requests' })).toBeInTheDocument();
        first.unmount();

        serve(() => Promise.resolve(new Response('', { status: 200 })));
        const second = render(<Home />);

        expect(await screen.findByText('Could not connect to the server.')).toHaveClass('id-error');
        expect(second.container.querySelector('[aria-labelledby="pv-title"] .ri-row')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Recommended Items' })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My Purchase Requests' })).toBeInTheDocument();
    });
});

const openItem = (listingId) => window.history.replaceState({}, '', `item.html?listing_id=${listingId}`);

// Item page: details come from get_item_details.php, everything else answers by file name.
function serveItem(listingId, name, price, record) {
    return serve(() => json(200, { success: true, items: [] }), {
        'get_item_details.php': () => json(200, {
            success: true,
            listing: { listing_id: listingId, name, price, condition: 'Good', category: 'Textbooks', description: null },
        }),
        'record_viewed_item.php': record,
    });
}

const recordCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => String(url).includes('record_viewed_item.php'));

describe('Recording a viewed item on the item page (card #217)', () => {
    it('Test 6: sends exactly one record request with the listing id', async () => {
        openItem(91001);
        const first = serveItem(91001, 'Calculus Textbook', '35.00', () => json(200, { success: true }));
        const a = render(<ItemDetails />);
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        const calls = recordCalls(first);
        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toMatch(/api\/record_viewed_item\.php$/);
        expect(calls[0][1].method).toBe('POST');
        expect(calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
        expect(calls[0][1].body).toBe('{"listing_id":91001}');
        a.unmount();

        openItem(91003);
        const second = serveItem(91003, 'Desk Lamp', '15.00', () => json(200, { success: true }));
        render(<ItemDetails />);
        expect(await screen.findByRole('heading', { name: 'Desk Lamp' })).toBeInTheDocument();
        expect(recordCalls(second)).toHaveLength(1);
        expect(recordCalls(second)[0][1].body).toBe('{"listing_id":91003}');
    });

    it('Test 7: the item page still works when recording fails', async () => {
        openItem(91001);
        for (const record of [
            () => json(200, { success: false, error: 'Server error.' }),
            () => Promise.resolve(new Response('', { status: 200 })),
        ]) {
            const fetchMock = serveItem(91001, 'Calculus Textbook', '35.00', record);
            const view = render(<ItemDetails />);
            expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
            expect(screen.getByText('$35.00')).toBeInTheDocument();
            await vi.waitFor(() => expect(recordCalls(fetchMock)).toHaveLength(1));
            expect(screen.queryByText('Server error.')).toBeNull();
            expect(screen.queryByText('Could not connect to the server.')).toBeNull();
            view.unmount();
        }
    });
});
