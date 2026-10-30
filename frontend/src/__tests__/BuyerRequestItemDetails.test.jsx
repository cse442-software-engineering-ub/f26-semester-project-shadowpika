/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html"}
 */
// Mirrors frontend task card #211 (Buyer Request Item Details Frontend) and its navbar update.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import Home from '../Home.jsx';
import NavBar from '../NavBar.jsx';
import { requestItemUrl } from '../meetingRequests.js';

vi.mock('../components/ListingMeetingLocation.jsx', () => ({
    default: () => <section><h2>Meeting Location</h2></section>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

const listing = { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', category: 'Textbooks', description: null };

// Answers each endpoint by file name; the buyer is not the owner, so Buy Now and the heart are allowed.
function serve(routes) {
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((file) => String(url).includes(file));
        return match ? routes[match]() : Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const itemRoutes = (details = () => json(200, { success: true, listing })) => ({
    'get_item_details.php': details,
    'get_listing_ownership.php': () => json(200, { success: true, is_owner: false }),
    'get_favorite_status.php': () => json(200, { success: true, saved: false }),
});

const open = (query) => window.history.replaceState({}, '', `item.html?${query}`);

describe('Frontend #211: item page opened from a purchase request', () => {
    beforeEach(() => open('listing_id=91002&from=request'));

    it('shows Back to home, the heart and no Buy Now or Meeting Location', async () => {
        serve(itemRoutes());
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Calculus Workbook' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', './home.html');
        expect(screen.queryByRole('link', { name: /Back to search/ })).not.toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Save to Favorites' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Meeting Location' })).not.toBeInTheDocument();
    });

    it('keeps the error text and Back to home when the listing cannot be loaded', async () => {
        serve(itemRoutes(() => json(404, { success: false, error: 'Listing not found.' })));
        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Listing not found.');
        expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', './home.html');
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
    });

    it('leaves the normal item page unchanged without from=request', async () => {
        open('listing_id=91002');
        serve(itemRoutes());
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Calculus Workbook' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Back to search/ })).toHaveAttribute('href', './product-search.html');
        expect(screen.queryByRole('link', { name: /Back to home/ })).not.toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Buy Now' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Meeting Location' })).toBeInTheDocument();
    });
});

describe('Frontend #211: My Purchase Requests links', () => {
    it('builds the request item address', () => {
        expect(requestItemUrl(91002)).toBe('./item.html?listing_id=91002&from=request');
    });

    it('links the picture and the name of each purchase request to its item page', async () => {
        serve({
            'get_my_meeting_requests.php': () => json(200, {
                success: true,
                requests: [{
                    request_id: 5, listing_id: 91002, name: 'Calculus Workbook', price: '20.00', image_url: null,
                    meeting_date: '2027-01-03', meeting_time: '09:05', location: 'Capen Hall Main Entrance', status: 'pending',
                }],
            }),
            'get_incoming_meeting_requests.php': () => json(200, { success: true, requests: [] }),
            'get_recommended_items.php': () => json(200, { success: true, items: [] }),
        });
        const { container } = render(<Home />);

        await screen.findByRole('heading', { name: 'Calculus Workbook' });
        const links = [...container.querySelectorAll('.mr-request a.mr-request-link')];
        expect(links).toHaveLength(2);
        links.forEach((link) => expect(link).toHaveAttribute('href', './item.html?listing_id=91002&from=request'));
        expect(screen.getByRole('heading', { name: 'Calculus Workbook' }).querySelector('a')).toBe(links[1]);
    });
});

describe('Frontend #211: navbar', () => {
    it('hides the Message items and marks the current page', () => {
        window.history.replaceState({}, '', '/CSE442/2026-Fall/cse-442j/davidjob/sell.html');
        serve({});
        const { container } = render(<NavBar />);

        const messageItems = [...container.querySelectorAll('li.nav-message-item')];
        expect(messageItems).toHaveLength(2);
        messageItems.forEach((item) => expect(item).toHaveTextContent('Message'));

        const current = container.querySelectorAll('[aria-current="page"]');
        expect(current).toHaveLength(2); // Sell, desktop and drawer
        current.forEach((link) => {
            expect(link).toHaveTextContent('Sell');
            expect(link).toHaveClass('is-current');
        });
        expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('title', 'Search');
    });

    it('marks Settings for any page under settings/', () => {
        window.history.replaceState({}, '', '/CSE442/2026-Fall/cse-442j/davidjob/settings/account-settings.html');
        serve({});
        const { container } = render(<NavBar />);

        const current = [...container.querySelectorAll('[aria-current="page"]')];
        expect(current.map((link) => link.textContent.trim())).toEqual(['Settings', 'Settings']);
    });
});
