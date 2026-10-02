/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html"}
 */
// Mirrors frontend task card #151 (View Item Details), using the same override payloads.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

function override(status, body) {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const openItem = (listingId) => window.history.replaceState({}, '', `item.html?listing_id=${listingId}`);

describe('Frontend: View Item Details (#151)', () => {
    beforeEach(() => openItem(91001));

    it('Test 1: requests the listing named in the address', async () => {
        openItem(91002);
        const fetchMock = override(200, {
            success: true,
            listing: { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', category: 'Textbooks', description: null },
        });
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Calculus Workbook' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('./api/get_item_details.php?listing_id=91002');
        expect(screen.getByText('$20.00')).toBeInTheDocument();
        expect(screen.getByText('Like New')).toBeInTheDocument();
    });

    it('Test 2: displays every detail from the server response', async () => {
        override(200, {
            success: true,
            listing: {
                listing_id: 91001,
                name: 'Calculus Textbook, 9th Edition',
                price: '29.50',
                condition: 'Like New',
                category: 'Books',
                description: 'Some highlighting in chapters 1-3.',
            },
        });
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Calculus Textbook, 9th Edition' })).toBeInTheDocument();
        expect(screen.getByText('$29.50')).toBeInTheDocument();
        expect(screen.getByText('Like New')).toBeInTheDocument();
        expect(screen.getByText('BOOKS')).toBeInTheDocument();
        expect(screen.getByText('Some highlighting in chapters 1-3.')).toBeInTheDocument();
    });

    it("Test 3: shows the server's error instead of item details", async () => {
        override(404, { success: false, error: 'Listing not found.' });
        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Listing not found.');
        expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
        expect(screen.queryByText('Condition')).not.toBeInTheDocument();
    });

    it('shows a connection error when the response is not JSON', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('<h1>Not Found</h1>', { status: 404 }))));
        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect to the server.');
    });

    it('notes when a listing has no description', async () => {
        override(200, {
            success: true,
            listing: { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', category: 'Textbooks', description: null },
        });
        render(<ItemDetails />);

        expect(await screen.findByText("The seller didn't add a description.")).toBeInTheDocument();
        expect(screen.getByText('TEXTBOOKS')).toBeInTheDocument();
    });
});
