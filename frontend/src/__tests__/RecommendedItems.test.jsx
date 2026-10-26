/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/home.html"}
 */
// Mirrors frontend task card #200 (Recommended Items Frontend), using the same payloads.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from '../Home.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

// Answers each endpoint by file name, like a DevTools override per request.
function serve(recommended) {
    const routes = {
        'get_recommended_items.php': recommended,
        'get_incoming_meeting_requests.php': () => json(200, { success: true, requests: [] }),
        'get_my_meeting_requests.php': () => json(200, {
            success: true,
            requests: [{ listing_id: 91001, name: 'Calculus Textbook', price: '35.00', image_url: null, meeting_date: '2027-01-03', meeting_time: '09:05', location: 'Capen Hall Main Entrance', status: 'approved' }],
        }),
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

describe('Recommended Items on Home (card #200)', () => {
    it('Test 1: requests once and shows each item in order with cover, name, and price, between Home and My Purchase Requests', async () => {
        const fetchMock = serve(() => json(200, three));
        const { container } = render(<Home />);

        expect(await screen.findByText('Physical Chemistry')).toBeInTheDocument();
        const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes('get_recommended_items.php'));
        expect(calls).toHaveLength(1);

        const cards = [...container.querySelectorAll('.ri-row li')];
        expect(cards.map((li) => li.textContent)).toEqual([
            expect.stringContaining('Physical Chemistry$60.00'),
            expect.stringContaining('Calculus Textbook$35.00'),
            expect.stringContaining('Desk Lamp$15.00'),
        ]);
        expect(cards[0].querySelector('img')).toHaveAttribute('src', 'uploads/physical-chemistry.jpg');
        expect(cards[1].querySelector('img')).toHaveAttribute('src', 'uploads/calculus-textbook.jpg');
        expect(cards[2].querySelector('img')).toBeNull();
        expect(cards[2].querySelector('.ps-book-placeholder')).not.toBeNull();

        const headings = screen.getAllByRole('heading').map((h) => h.textContent);
        expect(headings.indexOf('Home')).toBeLessThan(headings.indexOf('Recommended Items'));
        expect(headings.indexOf('Recommended Items')).toBeLessThan(headings.indexOf('My Purchase Requests'));
    });

    it('Test 2: puts 15 items in one row, in order', async () => {
        const items = Array.from({ length: 15 }, (_, i) => {
            const n = String(i + 1).padStart(2, '0');
            return { listing_id: 91801 + i, name: `Recommended Test Item ${n}`, price: `${i + 1}.00`, image_url: null };
        });
        serve(() => json(200, { success: true, items }));
        const { container } = render(<Home />);

        expect(await screen.findByRole('link', { name: /Recommended Test Item 01/ })).toBeInTheDocument();
        const rows = container.querySelectorAll('ul.ri-row');
        expect(rows).toHaveLength(1);
        const names = [...rows[0].querySelectorAll('.ri-name')].map((el) => el.textContent);
        expect(names).toEqual(items.map((item) => item.name));
        expect(rows[0].querySelectorAll('.ri-price')[14]).toHaveTextContent('$15.00');
    });

    it('Test 3: each item links to its details page', async () => {
        serve(() => json(200, three));
        render(<Home />);

        const link = (await screen.findByText('Physical Chemistry')).closest('a');
        expect(link).toHaveAttribute('href', './item.html?listing_id=91005');
    });

    it('Test 4: shows the empty message and no items', async () => {
        serve(() => json(200, { success: true, items: [] }));
        const { container } = render(<Home />);

        expect(await screen.findByText('No recommended items right now.')).toBeInTheDocument();
        expect(container.querySelector('.ri-row')).toBeNull();
    });

    it("Test 5: shows the server's error, then the connection error, while My Purchase Requests still loads", async () => {
        serve(() => json(200, { success: false, error: 'Server error.' }));
        const first = render(<Home />);

        expect(await screen.findByText('Server error.')).toHaveClass('id-error');
        expect(first.container.querySelector('.ri-row')).toBeNull();
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(screen.getByText('Approved')).toBeInTheDocument();
        first.unmount();

        serve(() => Promise.resolve(new Response('', { status: 200 })));
        const second = render(<Home />);

        expect(await screen.findByText('Could not connect to the server.')).toHaveClass('id-error');
        expect(second.container.querySelector('.ri-row')).toBeNull();
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(screen.getByText('Approved')).toBeInTheDocument();
    });
});
