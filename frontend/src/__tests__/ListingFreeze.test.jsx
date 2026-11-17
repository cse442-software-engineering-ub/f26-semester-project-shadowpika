/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/manage-listings.html"}
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import ManageListings from '../ManageListings.jsx';
import { MEETING_REFRESH_MS } from '../useMeetingList.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav>Karavan</nav> }));
const ITEM = { listing_id: 81, name: 'Matthew’s Album', price: '442.00', status: 'active',
    condition: 'Good', category: 'Other', description: 'Listing fixture', meeting_location: 'Baldy 19',
    image_url: null, can_mark_sold: false, sale_request_id: null, can_freeze: true, freeze_block_reason: null };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let items, read, post, fetchMock;
let showModalDescriptor, closeDescriptor;

// jsdom lacks the native dialog APIs; real focus trapping/backdrop are also checked in Chromium.
beforeAll(() => {
    showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true,
        value() { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true,
        value() { this.removeAttribute('open'); } });
});
afterAll(() => {
    for (const [name, descriptor] of [['showModal', showModalDescriptor], ['close', closeDescriptor]]) {
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
        else delete HTMLDialogElement.prototype[name];
    }
});
beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', 'manage-listings.html');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    items = [{ ...ITEM }];
    read = () => json({ success: true, results: items });
    post = (body) => {
        if (body.action === 'freeze_all') {
            const frozen = items.filter((item) => item.status === 'active' && item.can_freeze === true).length;
            const skipped = items.filter((item) => item.status === 'active' && item.can_freeze === false).length;
            items = items.map((item) => item.status === 'active' && item.can_freeze === true
                ? { ...item, status: 'inactive', can_freeze: false } : item);
            return json({ success: true, frozen_count: frozen, skipped_count: skipped, cancelled_request_count: 3 });
        }
        if (body.action === 'resume') {
            items = items.map((item) => item.listing_id === body.listing_id
                ? { ...item, status: 'active', can_freeze: true, freeze_block_reason: null } : item);
            return json({ success: true, listing_id: body.listing_id, status: 'active' });
        }
        throw new Error(`Unexpected mutation ${body.action}`);
    };
    fetchMock = vi.fn(async (url, options) => {
        if (url.endsWith('get_my_listings.php')) return read();
        if (url.endsWith('update_listing.php')) return post(JSON.parse(options.body));
        throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.useRealTimers());
const mount = async () => { let view; await act(async () => { view = render(<ManageListings />); }); return view; };
const writes = () => fetchMock.mock.calls.filter(([url]) => url.endsWith('update_listing.php'));
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Freeze All Listings' }));
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Freeze Listings', exact: true }));
const mixed = () => {
    items = [{ ...ITEM }, { ...ITEM, listing_id: 82, name: 'Backpack', can_freeze: false, freeze_block_reason: 'approved_meeting' },
        { ...ITEM, listing_id: 83, name: 'Study Lamp', can_freeze: false, freeze_block_reason: 'completed_meeting', can_mark_sold: true },
        { ...ITEM, listing_id: 84, name: 'Sold item', status: 'sold', can_freeze: false },
        { ...ITEM, listing_id: 85, name: 'Black Desk Lamp', status: 'inactive', can_freeze: false }];
};

it('cycles Tab and Shift+Tab inside the confirmation controls', async () => {
    await mount(); open();
    const first = screen.getByRole('button', { name: 'Close freeze confirmation' });
    const last = screen.getByRole('button', { name: 'Freeze Listings', exact: true });
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    expect(writes()).toHaveLength(0);
});

it.each(['Keep Listings', 'Close freeze confirmation', 'Escape'])('dismisses with %s without sending a mutation and returns focus', async (choice) => {
    await mount(); open();
    const dialog = screen.getByRole('dialog', { name: 'Freeze eligible active listings?' });
    expect(within(dialog).getByText(/both participants checked in/)).toBeVisible();
    expect(within(dialog).getByText(/will not restore those requests/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep Listings' })).toHaveFocus();
    expect(writes()).toHaveLength(0);
    if (choice === 'Escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
    else fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'View Active (1)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toHaveFocus();
});

it('waits for confirmation, blocks repeated clicks and shows exact server counts and paused results', async () => {
    mixed(); const response = deferred(); const apply = post;
    post = () => response.promise;
    await mount(); open();
    const freezeButton = screen.getByRole('button', { name: 'Freeze Listings', exact: true });
    fireEvent.click(freezeButton); fireEvent.click(freezeButton);
    expect(writes()).toHaveLength(1);
    const [url, options] = writes()[0];
    expect(url).toBe('/CSE442/2026-Fall/cse-442j/listing/api/update_listing.php');
    expect(options.credentials).toBe('same-origin');
    expect(JSON.parse(options.body)).toEqual({ action: 'freeze_all' });
    expect(screen.getByRole('button', { name: 'Freezing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep Listings' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText(/Paused 1 listing\./)).not.toBeInTheDocument();
    await act(async () => response.resolve(apply({ action: 'freeze_all' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Paused 1 listing. Skipped 2 listings with protected meetings. Canceled 3 unapproved requests.');
    expect(screen.getByRole('button', { name: 'View Paused (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'View Paused (2)' })).toHaveFocus();
    expect(screen.getByText('Matthew’s Album')).toBeVisible();
    expect(screen.getByText('Black Desk Lamp')).toBeVisible();
    expect(screen.queryByText('inactive')).not.toBeInTheDocument();
    expect(screen.getAllByText('Paused', { exact: true })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'View Active (2)' }));
    expect(screen.getByText('Backpack')).toBeVisible();
    expect(screen.getByText('Study Lamp')).toBeVisible();
    expect(screen.getByText(/Mark this listing as sold before pausing/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'View Sold (1)' }));
    expect(screen.getByText('Sold item')).toBeVisible();
});

it.each([
    ['missing flag', { can_freeze: undefined, freeze_block_reason: null }],
    ['missing reason', { can_freeze: true, freeze_block_reason: undefined }],
    ['contradictory metadata', { can_freeze: true, freeze_block_reason: 'approved_meeting' }],
])('fails closed with %s until a successful metadata reload', async (_, changes) => {
    items = [{ ...ITEM, ...changes }];
    await mount();
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toBeDisabled();
    expect(screen.getByText(/Freeze availability is unavailable/)).toBeVisible();
    items = [{ ...ITEM }];
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload listings' })));
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toBeEnabled();
    expect(writes()).toHaveLength(0);
});

it.each(['protected', 'empty', 'only paused and sold'])('disables freeze with an explanation when %s', async (state) => {
    if (state === 'protected') items = [{ ...ITEM, can_freeze: false, freeze_block_reason: 'approved_meeting' }];
    if (state === 'empty') items = [];
    if (state === 'only paused and sold') items = [{ ...ITEM, status: 'inactive', can_freeze: false }, { ...ITEM, listing_id: 82, status: 'sold', can_freeze: false }];
    await mount();
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toBeDisabled();
    expect(screen.getByText('No eligible active listings to freeze.')).toBeVisible();
    open(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes()).toHaveLength(0);
});

it('rechecks eligibility while the confirmation is open and allows a non-destructive exit', async () => {
    await mount(); open();
    items = [{ ...ITEM, can_freeze: false, freeze_block_reason: 'approved_meeting' }];
    await act(async () => fireEvent(window, new Event('focus')));
    expect(screen.getByRole('button', { name: 'Freeze Listings', exact: true })).toBeDisabled();
    confirm(); expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Listings' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Paused (0)' })).toHaveFocus();
});

it('does not let a pre-freeze poll reactivate the paused results', async () => {
    await mount();
    const old = deferred(); read = () => old.promise;
    await act(async () => vi.advanceTimersByTime(MEETING_REFRESH_MS));
    open();
    read = () => json({ success: true, results: items });
    await act(async () => confirm());
    await act(async () => old.resolve(json({ success: true, results: [{ ...ITEM }] })));
    expect(screen.getByRole('button', { name: 'View Active (0)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Paused (1)' })).toHaveAttribute('aria-pressed', 'true');
});

it.each(['server error', 'connection lost', 'malformed success'])('does not falsely report success after %s', async (failure) => {
    post = () => {
        if (failure === 'connection lost') throw new TypeError('Failed to fetch');
        return failure === 'server error' ? json({ success: false, error: 'Freeze rejected.' }, 409)
            : json({ success: true });
    };
    await mount(); open();
    await act(async () => confirm());
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText(/Paused 1 listing\./)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Active (1)' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('reloads a lost successful outcome and stays disabled if authoritative reload also fails', async () => {
    post = () => { items = [{ ...ITEM, status: 'inactive', can_freeze: false }]; throw new TypeError('Lost response'); };
    await mount(); open();
    read = () => { throw new TypeError('No connection'); };
    await act(async () => confirm());
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toBeDisabled();
    expect(screen.queryByText(/Paused 1 listing\./)).not.toBeInTheDocument();
    read = () => json({ success: true, results: items });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload listings' })));
    fireEvent.click(screen.getByRole('button', { name: 'View Paused (1)' }));
    expect(screen.getByText('Matthew’s Album')).toBeVisible();
    expect(screen.getByText('Paused', { exact: true })).toBeVisible();
    expect(writes()).toHaveLength(1);
});

it('restores one paused item through resume, blocks repeated clicks and displays server state', async () => {
    items = [{ ...ITEM, status: 'inactive', can_freeze: false }];
    const pending = deferred(); const apply = post; post = () => pending.promise;
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'View Paused (1)' }));
    const button = screen.getByRole('button', { name: 'Mark as available' });
    fireEvent.click(button); fireEvent.click(button);
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(writes()[0][1].body)).toEqual({ action: 'resume', listing_id: 81 });
    expect(button).toBeDisabled();
    expect(screen.queryByText('Listing marked as available.')).not.toBeInTheDocument();
    await act(async () => pending.resolve(apply({ action: 'resume', listing_id: 81 })));
    expect(screen.getByText('Listing marked as available.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'View Active (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'View Paused (0)' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Freeze All Listings' })).toBeEnabled();
});

it('keeps Paused after a rejected restore and rereads the actual item state', async () => {
    items = [{ ...ITEM, status: 'inactive', can_freeze: false }];
    post = () => json({ success: false, error: 'Restore rejected.' }, 409);
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'View Paused (1)' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as available' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Restore rejected.');
    expect(screen.getByText('Paused', { exact: true })).toBeVisible();
    expect(screen.queryByText('Listing marked as available.')).not.toBeInTheDocument();
});

it('does not reload or update a view unmounted during freezing', async () => {
    const pending = deferred(); post = () => pending.promise;
    const { unmount } = await mount(); open(); confirm();
    const reads = fetchMock.mock.calls.filter(([url]) => url.endsWith('get_my_listings.php')).length;
    unmount();
    await act(async () => pending.resolve(json({ success: true, frozen_count: 1, skipped_count: 0, cancelled_request_count: 0 })));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('get_my_listings.php'))).toHaveLength(reads);
});
