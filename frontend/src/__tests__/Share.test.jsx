/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html?listing_id=92001"}
 */
// Mirrors frontend task card #158 (Share List Frontend).
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import { shareListing, shareUrlFor } from '../shareListing.js';
import { clearReturnPath, isSafeSharePath, rememberItemPage, takeReturnPath } from '../returnTo.js';
import { itemPageFrom, itemUrlFrom } from '../meetingRequests.js';
import { redirectLoggedOut } from '../session-guard.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav aria-label="Main">Karavan navigation</nav> }));

const LISTING = {
    listing_id: 92001, name: 'Share Test Lamp', price: '20.00', condition: 'Good', image_url: null,
    category: 'Other', community: 'Karavan', description: 'Test lamp.',
};
const GOOD_SHARE = '{"success":true,"listing_id":92001,"share_path":"item.html?listing_id=92001"}';
const GENERIC = 'Could not copy the link. Please try again.';
const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

// Answers each endpoint by name; `share` is the get_share_link.php answer (a body string).
function stubApi({ details, share, owner = false }) {
    const fetchMock = vi.fn((url) => {
        if (url.includes('get_item_details')) return json(details);
        if (url.includes('get_share_link')) return Promise.resolve(new Response(share, { status: 200 }));
        if (url.includes('get_listing_ownership')) return json({ success: true, listing_id: 92001, is_owner: owner });
        if (url.includes('get_my_meeting_requests')) return json({ success: true, requests: [] });
        return json({ success: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const shareCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => url.includes('get_share_link'));

describe('Share button (#158)', () => {
    let writeText;
    beforeEach(() => {
        window.history.replaceState({}, '', 'item.html?listing_id=92001');
        writeText = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('Test 1: one GET per click, copies this site address plus the share path, shows Link copied!', async () => {
        const fetchMock = stubApi({ details: { success: true, listing: LISTING }, share: GOOD_SHARE });
        render(<ItemDetails />);
        fireEvent.click(await screen.findByRole('button', { name: 'Share' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Link copied!');
        expect(shareCalls(fetchMock)).toHaveLength(1);
        expect(shareCalls(fetchMock)[0]).toEqual(['./api/get_share_link.php?listing_id=92001', { credentials: 'same-origin' }]);
        expect(writeText).toHaveBeenCalledWith('https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html?listing_id=92001');
    });

    it('hovering Share shows the tooltip Copy a link to this item', async () => {
        stubApi({ details: { success: true, listing: LISTING }, share: '{}' });
        render(<ItemDetails />);
        expect(await screen.findByRole('button', { name: 'Share' })).toHaveAttribute('title', 'Copy a link to this item');
    });

    it('Test 2: Share shows for a non-owner (with the heart) and for the owner (without it)', async () => {
        stubApi({ details: { success: true, listing: LISTING }, share: '{}', owner: false });
        const { unmount } = render(<ItemDetails />);
        expect(await screen.findByRole('button', { name: 'Share' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Save to Favorites' })).toBeInTheDocument();
        unmount();

        stubApi({ details: { success: true, listing: LISTING }, share: '{}', owner: true });
        render(<ItemDetails />);
        expect(await screen.findByRole('button', { name: 'Share' })).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Save to Favorites' })).not.toBeInTheDocument());
    });

    it('Test 3: the server error text is shown as an alert and nothing is copied', async () => {
        stubApi({ details: { success: true, listing: LISTING }, share: '{"success":false,"error":"You must be logged in."}' });
        render(<ItemDetails />);
        fireEvent.click(await screen.findByRole('button', { name: 'Share' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('You must be logged in.');
        expect(screen.queryByText('Link copied!')).not.toBeInTheDocument();
        expect(writeText).not.toHaveBeenCalled();
    });

    it('Test 3: an empty answer shows the generic message and copies nothing', async () => {
        stubApi({ details: { success: true, listing: LISTING }, share: '' });
        render(<ItemDetails />);
        fireEvent.click(await screen.findByRole('button', { name: 'Share' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC);
        expect(writeText).not.toHaveBeenCalled();
    });

    it('Test 10: a sold listing shows the server message and no Share button', async () => {
        stubApi({ details: { success: false, error: 'This item has been sold.' }, share: '{}' });
        render(<ItemDetails />);

        expect(await screen.findByRole('alert')).toHaveTextContent('This item has been sold.');
        expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
        expect(screen.getByText('Back to search')).toBeInTheDocument();
    });

    it('Test 11: unsafe share paths are refused and the clipboard stays untouched', async () => {
        const unsafe = [
            'https://evil.example/item.html?listing_id=92001', 'item.html?listing_id=0', 'item.html?listing_id=92001&from=request',
            'item.html?listing_id=abc', '/item.html?listing_id=92001', 'item.html?listing_id=012', 42, null,
        ];
        for (const path of unsafe) {
            stubApi({ details: {}, share: JSON.stringify({ success: true, listing_id: 92001, share_path: path }) });
            expect(await shareListing(92001)).toEqual({ ok: false, message: GENERIC });
        }
        expect(writeText).not.toHaveBeenCalled();
    });

    it('a clipboard failure or network failure gives the generic message', async () => {
        stubApi({ details: {}, share: GOOD_SHARE });
        const failing = { writeText: vi.fn(() => Promise.reject(new Error('denied'))) };
        expect((await shareListing(92001, failing)).ok).toBe(false);
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
        expect(await shareListing(92001)).toEqual({ ok: false, message: GENERIC });
    });

    it('shareUrlFor puts the path after this site address and folder', () => {
        expect(shareUrlFor('item.html?listing_id=7')).toBe('https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/item.html?listing_id=7');
    });
});

describe('Shared link login return (#158)', () => {
    beforeEach(() => clearReturnPath());

    it('isSafeSharePath accepts only item.html?listing_id= and a whole number of 1 or more', () => {
        expect(isSafeSharePath('item.html?listing_id=92001')).toBe(true);
        const bad = ['item.html?listing_id=0', 'item.html?listing_id=abc', 'item.html?listing_id=12abc', '/item.html?listing_id=1', 'item.html?listing_id=1&from=x', '//evil.example', ''];
        for (const path of bad) expect(isSafeSharePath(path)).toBe(false);
    });

    it('remembers a valid item page once, and forgets it after one use', () => {
        rememberItemPage({ pathname: '/x/item.html', search: '?listing_id=92001' });
        expect(takeReturnPath()).toBe('item.html?listing_id=92001');
        expect(takeReturnPath()).toBeNull();
    });

    it('stores nothing for an invalid listing id and clears an older value', () => {
        rememberItemPage({ pathname: '/x/item.html', search: '?listing_id=92001' });
        rememberItemPage({ pathname: '/x/item.html', search: '?listing_id=abc' });
        expect(takeReturnPath()).toBeNull();
    });

    it('ignores a stored value that was changed to something unsafe', () => {
        window.sessionStorage.setItem('karavan_return_to', 'https://evil.example/');
        expect(takeReturnPath()).toBeNull();
    });

    it('the first check on an item page goes to Log In and remembers it; later checks and other pages go to 404', () => {
        const navigate = vi.fn();
        redirectLoggedOut(true, { pathname: '/CSE442/2026-Fall/cse-442j/davidjob/item.html', search: '?listing_id=92001' }, navigate);
        expect(navigate).toHaveBeenLastCalledWith('/CSE442/2026-Fall/cse-442j/davidjob/');
        expect(takeReturnPath()).toBe('item.html?listing_id=92001');

        redirectLoggedOut(false, { pathname: '/x/item.html', search: '?listing_id=92001' }, navigate);
        expect(navigate).toHaveBeenLastCalledWith(expect.stringMatching(/404\.html$/));
        expect(takeReturnPath()).toBeNull();

        redirectLoggedOut(true, { pathname: '/x/home.html', search: '' }, navigate);
        expect(navigate).toHaveBeenLastCalledWith(expect.stringMatching(/404\.html$/));
    });
});

describe('Back links (#158)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('accepts only request, favorites, home and messages', () => {
        for (const value of ['request', 'favorites', 'home', 'messages']) expect(itemPageFrom(`?listing_id=1&from=${value}`)).toBe(value);
        expect(itemPageFrom('?listing_id=1&from=evil')).toBe('');
        expect(itemPageFrom('?listing_id=1')).toBe('');
        expect(itemUrlFrom(5, 'home')).toBe('./item.html?listing_id=5&from=home');
    });

    it.each([
        ['home', 'Back to home', './home.html'],
        ['request', 'Back to home', './home.html'],
        ['messages', 'Back to messages', './message.html'],
        ['favorites', 'Back to favorites', './favorites.html'],
        ['', 'Back to search', './product-search.html'],
    ])('from=%s shows %s', async (from, text, href) => {
        window.history.replaceState({}, '', `item.html?listing_id=92001${from ? `&from=${from}` : ''}`);
        stubApi({ details: { success: true, listing: LISTING }, share: '{}' });
        render(<ItemDetails />);
        expect((await screen.findByText(text)).closest('a')).toHaveAttribute('href', href);
    });
});
