/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/product-search.html"}
 */
// Story 1: as a shopper, select the communities you want to shop from.
// Story 2: shoppers only see items from communities they're part of.
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductSearch from '../ProductSearch.jsx';
import ItemDetails from '../ItemDetails.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const ALL_OF_UB = { community_id: 91070, name: 'All of UB', automatic: true };
const KELLER = { community_id: 1, name: 'Keller Properties LLC', automatic: false };
const RIVERSIDE = { community_id: 2, name: 'Riverside Apartments', automatic: false };

const LISTINGS = [
    { listing_id: 91001, name: 'Calculus Textbook', price: '35.00', condition: 'Good', image_url: null, category: 'Textbooks', community: 'All of UB' },
    { listing_id: 92001, name: 'Keller Desk Lamp', price: '12.00', condition: 'Like New', image_url: null, category: 'Dorm Living', community: 'Keller Properties LLC' },
    { listing_id: 93001, name: 'Riverside Mini Fridge', price: '60.00', condition: 'Good', image_url: null, category: 'Dorm Living', community: 'Riverside Apartments' },
];

const jsonResponse = (status, body) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

// Behaves like the real endpoints for a shopper who joined Keller but not Riverside.
function mockBackend() {
    const backend = {
        joined: new Set([ALL_OF_UB.community_id, KELLER.community_id]),
        shopping: new Set([ALL_OF_UB.community_id, KELLER.community_id]),
        setShopping: null,
    };
    const all = [ALL_OF_UB, KELLER, RIVERSIDE];
    backend.fetch = vi.fn((url, options = {}) => {
        if (url.endsWith('list_communities.php')) {
            return jsonResponse(200, {
                success: true,
                communities: all.map((c) => ({ ...c, joined: backend.joined.has(c.community_id), shopping: backend.shopping.has(c.community_id) })),
            });
        }
        if (url.endsWith('set_shopping_communities.php')) {
            if (backend.setShopping) return jsonResponse(...backend.setShopping);
            const ids = JSON.parse(options.body).community_ids;
            backend.shopping = new Set(ids);
            return jsonResponse(200, { success: true, shopping_community_ids: all.map((c) => c.community_id).filter((id) => backend.shopping.has(id)) });
        }
        if (url.includes('search_listings.php')) {
            const names = all.filter((c) => backend.shopping.has(c.community_id)).map((c) => c.name);
            return jsonResponse(200, { success: true, results: LISTINGS.filter((l) => names.includes(l.community)) });
        }
        return jsonResponse(404, { success: false });
    });
    vi.stubGlobal('fetch', backend.fetch);
    return backend;
}

const callsTo = (fetchMock, file) => fetchMock.mock.calls.filter(([url]) => url.includes(file));
const shoppingBar = async () => within(await screen.findByRole('region', { name: 'Shopping from' }));

beforeEach(() => window.history.replaceState({}, '', '/CSE442/2026-Fall/cse-442j/product-search.html'));
afterEach(() => vi.unstubAllGlobals());

describe('Story 1: select the communities you want to shop from', () => {
    it('Test 1: lists every community the shopper is in, ticked when they shop from it', async () => {
        mockBackend();
        render(<ProductSearch />);

        const bar = await shoppingBar();
        expect(await bar.findByRole('checkbox', { name: 'All of UB' })).toBeChecked();
        expect(bar.getByRole('checkbox', { name: 'Keller Properties LLC' })).toBeChecked();
        expect(bar.queryByRole('checkbox', { name: 'Riverside Apartments' })).not.toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Keller Desk Lamp' })).toBeInTheDocument();
    });

    it('Test 2: unticking a community saves the choice and removes its items from the results', async () => {
        const backend = mockBackend();
        const user = userEvent.setup();
        render(<ProductSearch />);
        const bar = await shoppingBar();
        await screen.findByRole('heading', { name: 'Calculus Textbook' });

        await user.click(await bar.findByRole('checkbox', { name: 'All of UB' }));

        await waitFor(() => expect(screen.queryByRole('heading', { name: 'Calculus Textbook' })).not.toBeInTheDocument());
        expect(screen.getByRole('heading', { name: 'Keller Desk Lamp' })).toBeInTheDocument();
        expect(bar.getByRole('checkbox', { name: 'All of UB' })).not.toBeChecked();
        const [[, options]] = callsTo(backend.fetch, 'set_shopping_communities.php');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ community_ids: [KELLER.community_id] });
        expect(callsTo(backend.fetch, 'search_listings.php').length).toBeGreaterThanOrEqual(2);
    });

    it('Test 3: ticking a community back on brings its items back', async () => {
        const backend = mockBackend();
        backend.shopping = new Set([KELLER.community_id]);
        const user = userEvent.setup();
        render(<ProductSearch />);
        const bar = await shoppingBar();
        await screen.findByRole('heading', { name: 'Keller Desk Lamp' });
        expect(screen.queryByRole('heading', { name: 'Calculus Textbook' })).not.toBeInTheDocument();

        await user.click(await bar.findByRole('checkbox', { name: 'All of UB' }));

        expect(await screen.findByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
        expect(JSON.parse(callsTo(backend.fetch, 'set_shopping_communities.php')[0][1].body))
            .toEqual({ community_ids: [ALL_OF_UB.community_id, KELLER.community_id] });
    });

    it('Test 4: the last ticked community cannot be unticked', async () => {
        const backend = mockBackend();
        backend.shopping = new Set([KELLER.community_id]);
        render(<ProductSearch />);
        const bar = await shoppingBar();

        expect(await bar.findByRole('checkbox', { name: 'Keller Properties LLC' })).toBeDisabled();
        expect(bar.getByRole('checkbox', { name: 'All of UB' })).toBeEnabled();
    });

    it('Test 5: shows the server error and keeps the previous choice when saving fails', async () => {
        const backend = mockBackend();
        backend.setShopping = [403, { success: false, error: 'You can only shop from communities you have joined.' }];
        const user = userEvent.setup();
        render(<ProductSearch />);
        const bar = await shoppingBar();

        await user.click(await bar.findByRole('checkbox', { name: 'All of UB' }));

        expect(await bar.findByRole('alert')).toHaveTextContent('You can only shop from communities you have joined.');
        expect(bar.getByRole('checkbox', { name: 'All of UB' })).toBeChecked();
    });

    it('Test 6: "Join a community" opens the nav\'s community picker', async () => {
        mockBackend();
        const opened = vi.fn();
        window.addEventListener('karavan:open-communities', opened);
        const user = userEvent.setup();
        render(<ProductSearch />);

        await user.click((await shoppingBar()).getByRole('button', { name: 'Join a community' }));

        expect(opened).toHaveBeenCalledTimes(1);
        window.removeEventListener('karavan:open-communities', opened);
    });

    it('Test 7: joining or leaving from the nav refreshes the bar and the results', async () => {
        const backend = mockBackend();
        render(<ProductSearch />);
        const bar = await shoppingBar();
        await screen.findByRole('heading', { name: 'Keller Desk Lamp' });

        backend.joined.add(RIVERSIDE.community_id);
        backend.shopping.add(RIVERSIDE.community_id);
        window.dispatchEvent(new Event('karavan:communities-changed'));

        expect(await bar.findByRole('checkbox', { name: 'Riverside Apartments' })).toBeChecked();
        expect(await screen.findByRole('heading', { name: 'Riverside Mini Fridge' })).toBeInTheDocument();
    });
});

describe('Story 2: shoppers only see items from communities they are part of', () => {
    it('Test 1: the search page shows only what the server returns for the shopper\'s communities', async () => {
        mockBackend();
        render(<ProductSearch />);

        expect(await screen.findByRole('heading', { name: 'Keller Desk Lamp' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Riverside Mini Fridge' })).not.toBeInTheDocument();
        expect(screen.getByText('Showing active items from your communities')).toBeInTheDocument();
    });

    it('Test 2: the item page explains why a non-member cannot open an item and offers no Buy Now', async () => {
        window.history.replaceState({}, '', '/CSE442/2026-Fall/cse-442j/item.html?listing_id=93001');
        vi.stubGlobal('fetch', vi.fn((url) => (url.includes('get_item_details.php')
            ? jsonResponse(403, { success: false, error: 'This item is only available to members of its community.' })
            : jsonResponse(200, { success: true, listing_id: 93001, is_owner: false, saved: false }))));

        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('This item is only available to members of its community.');
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Save to Favorites' })).not.toBeInTheDocument();
    });

    it('Test 3: a signed-out visitor sees the login error instead of listings', async () => {
        vi.stubGlobal('fetch', vi.fn((url) => (url.includes('search_listings.php')
            ? jsonResponse(401, { success: false, error: 'You must be logged in.' })
            : jsonResponse(403, { success: false, error: 'You do not have permission to perform this action.' }))));

        render(<ProductSearch />);

        expect(await screen.findByText('You must be logged in.')).toBeInTheDocument();
        expect(screen.queryByRole('region', { name: 'Shopping from' })).not.toBeInTheDocument();
    });
});
