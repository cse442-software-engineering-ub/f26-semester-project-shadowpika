/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/manage-listings.html"}
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ManageListings from '../ManageListings.jsx';
import { MEETING_REFRESH_MS } from '../useMeetingList.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav>Karavan</nav> }));
const ITEM = { listing_id: 81, name: 'Temporary sale item', price: '12.00', status: 'active',
    condition: 'Good', category: 'Other', description: 'Temporary test listing', meeting_location: 'Agreed spot',
    image_url: null, can_mark_sold: false, sale_request_id: null };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
let items, read, post, fetchMock, hidden;
beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', 'manage-listings.html');
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    items = [{ ...ITEM }];
    read = () => json({ success: true, results: items });
    post = (body) => {
        items = body.action === 'delete' ? items.filter((item) => item.listing_id !== body.listing_id)
            : items.map((item) => item.listing_id === body.listing_id ? { ...item, status: body.status, can_mark_sold: false } : item);
        return json({ success: true, listing_id: body.listing_id, status: body.status });
    };
    fetchMock = vi.fn(async (url, options) => {
        if (url.endsWith('get_my_listings.php')) return read();
        if (url.endsWith('update_listing.php')) return post(JSON.parse(options.body));
        throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.useRealTimers());
const mount = async () => { let view; await act(async () => { view = render(<ManageListings />); }); return view; };
const tick = async () => act(async () => vi.advanceTimersByTime(MEETING_REFRESH_MS));
const calls = (endpoint) => fetchMock.mock.calls.filter(([url]) => url.endsWith(endpoint));

it('disables Sold before both arrivals and does not submit when clicked', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Mark as sold' })).toBeDisabled();
    expect(screen.getByText(/Both buyer and seller must check in/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' }));
    expect(calls('update_listing.php')).toHaveLength(0);
});

it('refreshes eligibility from another session without automatically selling', async () => {
    await mount();
    items = [{ ...ITEM, can_mark_sold: true, sale_request_id: 71 }];
    await tick();
    expect(screen.getByRole('button', { name: 'Mark as sold' })).toBeEnabled();
    expect(calls('update_listing.php')).toHaveLength(0);
    expect(calls('get_my_listings.php')).toHaveLength(2);
    expect(calls('get_my_listings.php')[1][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
});

it('waits for server confirmation, sends the qualifying request and blocks duplicate clicks', async () => {
    items = [{ ...ITEM, can_mark_sold: true, sale_request_id: 71 }];
    const pending = deferred(); post = () => pending.promise;
    await mount();
    const button = screen.getByRole('button', { name: 'Mark as sold' });
    fireEvent.click(button); fireEvent.click(button);
    expect(calls('update_listing.php')).toHaveLength(1);
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'View Active (1)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Sold (0)' })).toBeVisible();
    const [url, options] = calls('update_listing.php')[0];
    expect(url).toBe('/CSE442/2026-Fall/cse-442j/listing/api/update_listing.php');
    expect(options.credentials).toBe('same-origin');
    expect(JSON.parse(options.body)).toEqual({ action: 'update_status', listing_id: 81, status: 'sold', request_id: 71 });
    items = [{ ...items[0], status: 'sold', can_mark_sold: false }];
    await act(async () => pending.resolve(json({ success: true, status: 'sold' })));
    expect(screen.getByText('Listing marked as sold.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Sold (1)' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'View Sold (1)' }));
    expect(screen.getByText(ITEM.name)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark as available' })).toBeEnabled();
});

it.each([409, 200])('keeps Active on a rejected response with HTTP %s and shows the server message', async (status) => {
    items = [{ ...ITEM, can_mark_sold: true, sale_request_id: 71 }];
    post = () => {
        items = [{ ...ITEM }];
        return json({ success: false, error: 'Both parties must check in first.' }, status);
    };
    await mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Both parties must check in first.');
    expect(screen.getByRole('button', { name: 'View Active (1)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Sold (0)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark as sold' })).toBeDisabled();
    expect(screen.queryByText('Listing marked as sold.')).not.toBeInTheDocument();
});

it('reloads authoritative Sold state after a successful write loses its response', async () => {
    items = [{ ...ITEM, can_mark_sold: true }];
    post = () => { items = [{ ...ITEM, status: 'sold' }]; throw new TypeError('Failed to fetch'); };
    await mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Reload to check the listing status.');
    expect(screen.getByRole('button', { name: 'View Sold (1)' })).toBeVisible();
    expect(screen.queryByText('Listing marked as sold.')).not.toBeInTheDocument();
});

it('does not let a pre-sale poll restore an active listing after a successful sale', async () => {
    items = [{ ...ITEM, can_mark_sold: true }];
    await mount();
    const old = deferred(); read = () => old.promise;
    await tick();
    read = () => json({ success: true, results: items });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' })));
    await act(async () => old.resolve(json({ success: true, results: [ITEM] })));
    expect(screen.getByRole('button', { name: 'View Active (0)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Sold (1)' })).toBeVisible();
});

it('pauses while hidden, reloads on return/focus, and removes listeners on unmount', async () => {
    const { unmount } = await mount();
    hidden = true; fireEvent(document, new Event('visibilitychange'));
    await tick();
    expect(calls('get_my_listings.php')).toHaveLength(1);
    items = [{ ...ITEM, can_mark_sold: true }];
    hidden = false;
    await act(async () => fireEvent(document, new Event('visibilitychange')));
    expect(screen.getByRole('button', { name: 'Mark as sold' })).toBeEnabled();
    await act(async () => fireEvent(window, new Event('focus')));
    expect(calls('get_my_listings.php')).toHaveLength(3);
    unmount(); await tick(); fireEvent(window, new Event('focus'));
    expect(calls('get_my_listings.php')).toHaveLength(3);
});

it('preserves known listings on load failure and recovers using Reload listings', async () => {
    await mount();
    read = () => { throw new TypeError('Failed to fetch'); };
    await tick();
    expect(screen.getByText(ITEM.name)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not connect to the server.');
    read = () => json({ success: true, results: items });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload listings' })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not replace an unsaved edit with a poll or focus refresh', async () => {
    const { container } = await mount();
    fireEvent.click(screen.getByText('Edit listing'));
    await act(async () => fireEvent(window, new Event('hashchange')));
    const title = container.querySelector('form input[type="text"]');
    fireEvent.change(title, { target: { value: 'Unsaved title' } });
    await tick(); fireEvent(window, new Event('focus'));
    expect(calls('get_my_listings.php')).toHaveLength(1);
    expect(title).toHaveValue('Unsaved title');
});

it('waits for delete confirmation and keeps the listing if deletion fails', async () => {
    post = () => json({ success: false, error: 'Delete failed.' }, 409);
    await mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Delete failed.');
    expect(screen.getByText(ITEM.name)).toBeVisible();
});
