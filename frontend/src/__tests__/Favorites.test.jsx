/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html"}
 */
// Mirrors frontend task card #99 (Favorites Tab Frontend), using the same override payloads.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import Favorites from '../Favorites.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const WORKBOOK = { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', category: 'Textbooks', description: null };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Answers each endpoint by file name; `routes` maps a file name to a body or a function returning one.
function mockApi(routes) {
    const fetchMock = vi.fn((url) => {
        const name = String(url).split('?')[0].split('/').pop();
        const body = typeof routes[name] === 'function' ? routes[name]() : routes[name];
        return Promise.resolve(json(body ?? { success: false, error: 'unexpected' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const openItem = (listingId) => window.history.replaceState({}, '', `item.html?listing_id=${listingId}`);

const itemRoutes = (extra = {}) => ({
    'get_item_details.php': { success: true, listing: WORKBOOK },
    'get_listing_ownership.php': { success: true, is_owner: false },
    'get_favorite_status.php': { success: true, listing_id: 91002, saved: false },
    ...extra,
});

describe('Frontend: Favorites Tab (#99) - heart on the item page', () => {
    beforeEach(() => openItem(91002));

    it('Test 1: sends the item to be saved and fills the heart only after success', async () => {
        const fetchMock = mockApi(itemRoutes({ 'save_favorite.php': { success: true, listing_id: 91002, saved: true } }));
        render(<ItemDetails />);

        const heart = await screen.findByRole('button', { name: 'Save to Favorites' });
        expect(fetchMock).toHaveBeenCalledWith('./api/get_favorite_status.php?listing_id=91002', { credentials: 'same-origin' });
        expect(heart).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(heart);

        await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
        const save = fetchMock.mock.calls.find(([url]) => url === './api/save_favorite.php');
        expect(save[1].body).toBe('{"listing_id":91002}');
    });

    it('Test 2: hides the heart on the user\'s own item', async () => {
        mockApi(itemRoutes({ 'get_listing_ownership.php': { success: true, is_owner: true } }));
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Calculus Workbook' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save to Favorites' })).not.toBeInTheDocument();
    });

    it('Test 3: fills the heart when the server says saved, outlines it when not', async () => {
        mockApi(itemRoutes({ 'get_favorite_status.php': { success: true, listing_id: 91002, saved: true } }));
        const first = render(<ItemDetails />);
        const filled = await screen.findByRole('button', { name: 'Save to Favorites' });
        await waitFor(() => expect(filled).toHaveAttribute('aria-pressed', 'true'));
        first.unmount();

        mockApi(itemRoutes());
        render(<ItemDetails />);
        expect(await screen.findByRole('button', { name: 'Save to Favorites' })).toHaveAttribute('aria-pressed', 'false');
    });

    it("Test 4: shows the server's error and keeps the heart outlined when saving fails", async () => {
        mockApi(itemRoutes({ 'save_favorite.php': { success: false, error: 'Listing not found.' } }));
        render(<ItemDetails />);

        const heart = await screen.findByRole('button', { name: 'Save to Favorites' });
        fireEvent.click(heart);

        expect(await screen.findByRole('alert')).toHaveTextContent('Listing not found.');
        expect(heart).toHaveAttribute('aria-pressed', 'false');
    });
});

describe('Frontend: Favorites Tab (#99) - navbar heart', () => {
    it('Test 5: links a heart icon to favorites.html and has no Favorites entry in the menu', async () => {
        const { default: RealNavBar } = await vi.importActual('../NavBar.jsx');
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: false }, 403))));
        const { container } = render(<RealNavBar />);

        const heart = screen.getByRole('link', { name: 'Favorites' });
        expect(heart.getAttribute('href')).toMatch(/favorites\.html$/);
        expect(container.querySelectorAll('.nav-drawer')).toHaveLength(1);
        expect(container.querySelector('.nav-drawer')).not.toHaveTextContent('Favorites');
        expect(container.querySelector('.nav-links')).not.toHaveTextContent('Favorites');
    });
});

describe('Frontend: Favorites Tab (#99) - Favorites page', () => {
    it('Test 6: lists every saved item in order, with a link to the item', async () => {
        mockApi({
            'get_favorites.php': {
                success: true,
                favorites: [
                    { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', image_url: './assets/icons/favicon.svg', category: 'Textbooks' },
                    { listing_id: 92001, name: 'Graphing Calculator', price: '60.00', condition: 'Good', image_url: null, category: 'Electronics' },
                    { listing_id: 92002, name: 'Desk Chair', price: '25.00', condition: 'Fair', image_url: 'uploads/missing-photo.jpg', category: 'Dorm Living' },
                ],
            },
        });
        const { container } = render(<Favorites />);

        expect(await screen.findByRole('heading', { name: 'Favorites' })).toBeInTheDocument();
        const names = (await screen.findAllByRole('link')).map((link) => link.textContent);
        expect(names).toEqual(['Calculus Workbook', 'Graphing Calculator', 'Desk Chair']);
        expect(screen.getByText('$20.00')).toBeInTheDocument();
        expect(screen.getByText('Like New')).toBeInTheDocument();
        expect(screen.getByText('$60.00')).toBeInTheDocument();
        expect(screen.getByText('Good')).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
        expect(screen.getByText('Fair')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Calculus Workbook' })).toHaveAttribute('href', './item.html?listing_id=91002');
        expect(screen.getByRole('img', { name: 'Calculus Workbook listing' })).toHaveAttribute('src', './assets/icons/favicon.svg');

        fireEvent.error(screen.getByRole('img', { name: 'Desk Chair listing' }));
        const drawn = [...container.querySelectorAll('.ps-book-title')].map((title) => title.textContent);
        expect(drawn).toEqual(['Graphing Calculator', 'Desk Chair']);
    });

    it("Test 7: shows the empty-list message, or the server's error with no cards", async () => {
        mockApi({ 'get_favorites.php': { success: true, favorites: [] } });
        const first = render(<Favorites />);
        expect(await screen.findByText('You have no saved items yet.')).toBeInTheDocument();
        expect(first.container.querySelector('.ps-book-card')).toBeNull();
        first.unmount();

        mockApi({ 'get_favorites.php': { success: false, error: 'Unable to load your saved items.' } });
        const second = render(<Favorites />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your saved items.');
        expect(screen.queryByText('You have no saved items yet.')).not.toBeInTheDocument();
        expect(second.container.querySelector('.ps-book-card')).toBeNull();
    });
});
