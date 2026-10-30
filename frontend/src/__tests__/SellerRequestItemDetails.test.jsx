/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html"}
 */
// Mirrors frontend task card #212 (Seller Request Item Details Frontend).
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import IncomingRequests from '../IncomingRequests.jsx';

vi.mock('../components/ListingMeetingLocation.jsx', () => ({
    default: () => <section><h2>Meeting Location</h2></section>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

// Answers each endpoint by file name.
function serve(routes) {
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((file) => String(url).includes(file));
        return match ? routes[match]() : Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const open = (query) => window.history.replaceState({}, '', `item.html?${query}`);

const request = (id, listingId, name, price) => ({
    request_id: id, listing_id: listingId, name, price, image_url: null, buyer: 'Chun Buyer',
    meeting_date: '2027-01-03', meeting_time: '09:05', location: 'Capen Hall Main Entrance', status: 'pending',
});

describe('Frontend #212: Requests for My Items links', () => {
    it('links the picture and the name of each request to its item page', async () => {
        serve({
            'get_incoming_meeting_requests.php': () => json(200, {
                success: true,
                requests: [
                    request(1, 91006, 'Genetics: A Conceptual Approach', '45.00'),
                    request(2, 91008, 'Organic Chemistry Textbook', '30.00'),
                ],
            }),
        });
        const { container } = render(<IncomingRequests />);

        await screen.findByRole('heading', { name: 'Genetics: A Conceptual Approach' });
        const links = [...container.querySelectorAll('.mr-request a.mr-request-link')];
        expect(links).toHaveLength(4);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            './item.html?listing_id=91006&from=request',
            './item.html?listing_id=91006&from=request',
            './item.html?listing_id=91008&from=request',
            './item.html?listing_id=91008&from=request',
        ]);
        expect(screen.getByRole('heading', { name: 'Organic Chemistry Textbook' }).querySelector('a')).toBe(links[3]);
    });
});

describe('Frontend #212: item page opened by the seller from a request', () => {
    it('shows the details and Back to home with no heart, Buy Now, Message Seller or Meeting Location', async () => {
        open('listing_id=91009&from=request');
        serve({
            'get_item_details.php': () => json(200, {
                success: true,
                listing: { listing_id: 91009, name: 'Seller Owned Item', price: '25.00', condition: 'Good', category: 'Textbooks', description: null },
            }),
            'get_listing_ownership.php': () => json(200, { success: true, is_owner: true }),
            'get_favorite_status.php': () => json(200, { success: true, saved: false }),
        });
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Seller Owned Item' })).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
        expect(screen.getByText('Good')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', './home.html');
        expect(screen.queryByRole('link', { name: /Back to search/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save to Favorites' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Message Seller' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Meeting Location' })).not.toBeInTheDocument();
    });

    it('shows the error and Back to home when the listing is not found', async () => {
        open('listing_id=91009&from=request');
        serve({
            'get_item_details.php': () => json(404, { success: false, error: 'Listing not found.' }),
            'get_listing_ownership.php': () => json(200, { success: true, is_owner: true }),
        });
        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Listing not found.');
        expect(screen.getByRole('link', { name: /Back to home/ })).toHaveAttribute('href', './home.html');
    });
});
