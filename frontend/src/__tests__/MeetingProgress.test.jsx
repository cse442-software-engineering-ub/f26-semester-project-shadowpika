/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/home.html"}
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from '../Home.jsx';
import { MEETING_REFRESH_MS } from '../useMeetingList.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav>Karavan</nav> }));
vi.mock('../RecommendedItems.jsx', () => ({ default: () => <section>Recommendations</section> }));

const REQUEST = { request_id: 71, listing_id: 81, name: 'Temporary meeting', price: '12.00', image_url: null,
    meeting_date: '2026-11-06', meeting_time: '12:00', location: 'Agreed spot', community: 'QA', buyer: 'buyer@test.invalid',
    status: 'approved', checked_in_at: null, buyer_checked_in_at: null, seller_checked_in_at: null,
    both_checked_in: false, can_mark_sold: false, listing_status: 'active' };
const CHECKED_AT = '2026-11-06T17:03:00.000Z';
const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};
let purchases, incoming, buyerLoad, sellerLoad, respond, cancel, locations, sale, fetchMock, hidden;
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T17:00:00Z'));
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    purchases = [];
    incoming = [];
    buyerLoad = () => json({ success: true, requests: purchases });
    sellerLoad = () => json({ success: true, requests: incoming });
    respond = () => json({ success: true, request: { ...REQUEST, status: 'approved' } });
    cancel = () => json({ success: true });
    locations = () => json({ success: true, locations: [{ location_id: 92, label: 'Other spot' }] });
    sale = () => json({ success: true, listing_id: 81, status: 'sold', request_id: 71 });
    fetchMock = vi.fn((url) => {
        if (url.includes('get_my_meeting_requests.php')) return Promise.resolve(buyerLoad());
        if (url.includes('get_incoming_meeting_requests.php')) return Promise.resolve(sellerLoad());
        if (url.includes('respond_meeting_request.php')) return Promise.resolve(respond());
        if (url.includes('cancel_meeting_request.php')) return Promise.resolve(cancel());
        if (url.includes('get_meeting_locations.php')) return Promise.resolve(locations());
        if (url.includes('update_listing.php')) return Promise.resolve(sale());
        throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.useRealTimers());
const mount = async () => { let view; await act(async () => { view = render(<Home />); }); return view; };
const tick = async () => act(async () => vi.advanceTimersByTime(MEETING_REFRESH_MS));
const calls = (endpoint) => fetchMock.mock.calls.filter(([url]) => url.includes(endpoint));

const READY = { ...REQUEST, checked_in_at: CHECKED_AT, buyer_checked_in_at: CHECKED_AT,
    seller_checked_in_at: '2026-11-06T17:04:00Z', both_checked_in: true, can_mark_sold: true };

it.each(['buyer', 'seller'])('shows independent progress and only the remaining participants entry after %s arrives first', async (first) => {
    const row = { ...REQUEST, checked_in_at: first === 'buyer' ? CHECKED_AT : null,
        buyer_checked_in_at: first === 'buyer' ? CHECKED_AT : null,
        seller_checked_in_at: first === 'seller' ? CHECKED_AT : null };
    purchases = [row]; incoming = [row];
    await mount();
    const buyer = within(screen.getByRole('region', { name: 'My Purchase Requests' }));
    const seller = within(screen.getByRole('region', { name: 'Requests for My Items' }));
    expect(buyer.queryByRole('link', { name: 'Check In' }) !== null).toBe(first !== 'buyer');
    expect(seller.queryByRole('link', { name: 'Check In' }) !== null).toBe(first !== 'seller');
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
    incoming = [READY]; purchases = [{ ...READY, can_mark_sold: false }];
    await tick();
    expect(screen.queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
    expect(seller.getByRole('button', { name: 'Mark as sold' })).toBeEnabled();
    expect(buyer.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
    expect(seller.getByText(/You checked in at/)).toHaveTextContent('12:04 PM');
    expect(buyer.getByText(/Seller checked in at/)).toHaveTextContent('12:04 PM');
    expect(calls('update_listing.php')).toHaveLength(0);
});

it('confirms an explicit sale, blocks double clicks, invalidates old polls and updates every request for that listing', async () => {
    incoming = [READY, { ...REQUEST, request_id: 72 }];
    await mount();
    const old = deferred(); const pending = deferred();
    sellerLoad = () => old.promise;
    await tick();
    sale = () => pending.promise;
    const button = screen.getByRole('button', { name: 'Mark as sold' });
    fireEvent.click(button); fireEvent.click(button);
    expect(calls('update_listing.php')).toHaveLength(1);
    expect(screen.queryByText('Listing marked as sold.')).not.toBeInTheDocument();
    expect(JSON.parse(calls('update_listing.php')[0][1].body)).toEqual({
        action: 'update_status', listing_id: 81, status: 'sold', request_id: 71,
    });
    incoming = incoming.map((row) => ({ ...row, listing_status: 'sold', can_mark_sold: false }));
    sellerLoad = () => json({ success: true, requests: incoming });
    await act(async () => pending.resolve(json({ success: true, status: 'sold' })));
    await act(async () => old.resolve(json({ success: true, requests: [READY] })));
    expect(screen.getByText('Listing marked as sold.')).toBeVisible();
    expect(screen.queryByText('Temporary meeting')).not.toBeInTheDocument();
    expect(screen.getByText('No one has requested your items yet.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
});

it('shows a Sold rejection and reloads attendance without claiming success', async () => {
    incoming = [READY];
    await mount();
    incoming = [{ ...REQUEST }];
    sale = () => new Response(JSON.stringify({ success: false, code: 'checkins_required', error: 'Both parties must check in first.' }), { status: 409 });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Both parties must check in first.');
    expect(screen.queryByText('Listing marked as sold.')).not.toBeInTheDocument();
    expect(screen.queryByText('Listing sold.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check In' })).toBeVisible();
});

it('does not trust a sale hint when one timestamp is missing or the listing is already sold', async () => {
    incoming = [
        { ...READY, seller_checked_in_at: null },
        { ...READY, request_id: 72, buyer_checked_in_at: null },
        { ...READY, request_id: 73, listing_status: 'sold' },
        { ...READY, request_id: 74, status: 'pending' },
    ];
    await mount();
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
    expect(calls('update_listing.php')).toHaveLength(0);
});

it('hides sold listings from both Home lists on first load while keeping all unsold statuses', async () => {
    const rows = [
        { ...READY, name: 'Sold approved item', listing_status: 'sold' },
        { ...REQUEST, request_id: 72, name: 'Sold pending item', status: 'pending', listing_status: 'sold' },
        { ...READY, request_id: 73, listing_id: 83, name: 'Checked in but still active' },
        { ...REQUEST, request_id: 74, listing_id: 84, name: 'Denied active item', status: 'denied' },
    ];
    purchases = rows; incoming = rows;
    await mount();
    expect(screen.queryByText('Sold approved item')).not.toBeInTheDocument();
    expect(screen.queryByText('Sold pending item')).not.toBeInTheDocument();
    for (const name of ['My Purchase Requests', 'Requests for My Items']) {
        const region = within(screen.getByRole('region', { name }));
        expect(region.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
            .toEqual(['Checked in but still active', 'Denied active item']);
    }
    expect(screen.queryByText('Listing sold.')).not.toBeInTheDocument();
});

it('shows the normal empty states when every request belongs to a sold listing', async () => {
    purchases = [{ ...READY, listing_status: 'sold' }];
    incoming = purchases;
    await mount();
    expect(screen.getByText('You have no purchase requests yet.')).toBeVisible();
    expect(screen.getByText('No one has requested your items yet.')).toBeVisible();
    expect(screen.queryByText('Temporary meeting')).not.toBeInTheDocument();
});

it.each(['poll', 'focus', 'return'])('removes a listing sold in another session on %s and keeps unrelated requests', async (trigger) => {
    const other = { ...REQUEST, request_id: 73, listing_id: 83, name: 'Still active' };
    purchases = [READY, other];
    incoming = [READY, { ...READY, request_id: 72 }, other];
    await mount();
    purchases = purchases.map((row) => row.listing_id === 81 ? { ...row, listing_status: 'sold' } : row);
    incoming = incoming.map((row) => row.listing_id === 81 ? { ...row, listing_status: 'sold' } : row);
    if (trigger === 'poll') await tick();
    else if (trigger === 'focus') await act(async () => fireEvent(window, new Event('focus')));
    else {
        hidden = true; fireEvent(document, new Event('visibilitychange'));
        hidden = false;
        await act(async () => fireEvent(document, new Event('visibilitychange')));
    }
    expect(screen.queryByText('Temporary meeting')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: 'Still active' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Mark as sold' })).not.toBeInTheDocument();
});

it('removes a confirmed sale immediately even when the follow-up refresh fails', async () => {
    incoming = [READY, { ...READY, request_id: 72 }];
    await mount();
    sellerLoad = () => { throw new TypeError('Failed to fetch'); };
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'Mark as sold' })[0]));
    expect(screen.getByText('Listing marked as sold.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not connect to the server.');
    expect(screen.queryByText('Temporary meeting')).not.toBeInTheDocument();
    expect(screen.getByText('No one has requested your items yet.')).toBeVisible();
});

it('hides a remotely confirmed sale after its POST response is lost without inventing success', async () => {
    incoming = [READY];
    await mount();
    sale = () => {
        incoming = [{ ...READY, listing_status: 'sold', can_mark_sold: false }];
        throw new TypeError('Connection lost');
    };
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as sold' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Reload to check the listing status.');
    expect(screen.queryByText('Listing marked as sold.')).not.toBeInTheDocument();
    expect(screen.queryByText('Temporary meeting')).not.toBeInTheDocument();
});

it('shows persisted check-in for both roles in New York time, with locked addresses and no submit entry', async () => {
    purchases = [{ ...REQUEST, checked_in_at: CHECKED_AT }];
    incoming = [{ ...REQUEST, checked_in_at: CHECKED_AT, seller_checked_in_at: CHECKED_AT }];
    await mount();
    const buyer = screen.getByRole('region', { name: 'My Purchase Requests' });
    const seller = screen.getByRole('region', { name: 'Requests for My Items' });
    expect(buyer).toHaveTextContent('Checked in at Nov 6, 2026, 12:03 PM.');
    expect(seller).toHaveTextContent('Buyer checked in at Nov 6, 2026, 12:03 PM.');
    expect(screen.getAllByText('Meeting location locked after approval.')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change Location' })).not.toBeInTheDocument();
    expect(buyer.querySelector('time')).toHaveAttribute('datetime', CHECKED_AT);
});

it('polls both lists and shows a check-in performed from another account', async () => {
    purchases = [{ ...REQUEST }]; incoming = [{ ...REQUEST }];
    await mount();
    expect(screen.getByText('Buyer has not checked in yet.')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'My Purchase Requests' })).getByRole('link', { name: 'Check In' })).toHaveAttribute('href', './check-in.html?request_id=71');
    purchases = [{ ...REQUEST, checked_in_at: CHECKED_AT }]; incoming = purchases;
    await tick();
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'My Purchase Requests' })).queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Requests for My Items' })).getByRole('link', { name: 'Check In' })).toBeVisible();
    for (const name of ['get_my_meeting_requests.php', 'get_incoming_meeting_requests.php']) {
        expect(calls(name)).toHaveLength(2);
        expect(calls(name)[1][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
    }
});

it('pauses hidden-page reads, refreshes on return and focus, and cleans up on unmount', async () => {
    const { unmount } = await mount();
    hidden = true;
    fireEvent(document, new Event('visibilitychange'));
    await tick();
    expect(calls('get_my_meeting_requests.php')).toHaveLength(1);
    incoming = [{ ...REQUEST, checked_in_at: CHECKED_AT }];
    hidden = false;
    await act(async () => fireEvent(document, new Event('visibilitychange')));
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
    await act(async () => fireEvent(window, new Event('focus')));
    expect(calls('get_my_meeting_requests.php')).toHaveLength(3);
    unmount();
    await tick();
    fireEvent(window, new Event('focus'));
    expect(calls('get_my_meeting_requests.php')).toHaveLength(3);
});

it('keeps known progress on a refresh failure and recovers with the retry button', async () => {
    incoming = [{ ...REQUEST, checked_in_at: CHECKED_AT }];
    await mount();
    sellerLoad = () => { throw new TypeError('Failed to fetch'); };
    await tick();
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not connect to the server.');
    sellerLoad = () => json({ success: true, requests: incoming });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload incoming requests' })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
});

it('does not let an older poll overwrite newer progress after returning to the page', async () => {
    incoming = [{ ...REQUEST }];
    await mount();
    const old = deferred();
    sellerLoad = () => old.promise;
    await tick();
    sellerLoad = () => json({ success: true, requests: [{ ...REQUEST, checked_in_at: CHECKED_AT }] });
    await act(async () => fireEvent(window, new Event('focus')));
    await act(async () => old.resolve(json({ success: true, requests: [{ ...REQUEST }] })));
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
});

it('invalidates an in-flight poll when approving and blocks duplicate submissions', async () => {
    incoming = [{ ...REQUEST, status: 'pending' }];
    await mount();
    const old = deferred(); const post = deferred();
    sellerLoad = () => old.promise; respond = () => post.promise;
    await tick();
    const approve = screen.getByRole('button', { name: 'Approve' });
    fireEvent.click(approve); fireEvent.click(approve);
    await tick();
    expect(calls('respond_meeting_request.php')).toHaveLength(1);
    expect(calls('get_incoming_meeting_requests.php')).toHaveLength(2);
    await act(async () => post.resolve(json({ success: true, request: { ...REQUEST } })));
    await act(async () => old.resolve(json({ success: true, requests: [{ ...REQUEST, status: 'pending' }] })));
    expect(screen.getByText('Meeting location locked after approval.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change Location' })).not.toBeInTheDocument();
});

it('closes an open location picker when another session approves the meeting', async () => {
    incoming = [{ ...REQUEST, status: 'pending' }];
    await mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Change Location' })));
    expect(screen.getByLabelText('New meeting location')).toBeVisible();
    incoming = [{ ...REQUEST }];
    await tick();
    expect(screen.queryByLabelText('New meeting location')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send New Location' })).not.toBeInTheDocument();
    expect(screen.getByText('Agreed spot')).toBeVisible();
    expect(calls('respond_meeting_request.php')).toHaveLength(0);
});

it('does not reopen a late location picker if approval happened while its options were loading', async () => {
    incoming = [{ ...REQUEST, status: 'pending' }];
    await mount();
    const late = deferred(); locations = () => late.promise;
    fireEvent.click(screen.getByRole('button', { name: 'Change Location' }));
    incoming = [{ ...REQUEST }];
    await act(async () => late.resolve(json({ success: true, locations: [{ location_id: 92, label: 'Other spot' }] })));
    expect(screen.queryByLabelText('New meeting location')).not.toBeInTheDocument();
    expect(screen.getByText('Meeting location locked after approval.')).toBeVisible();
});

it('reloads the authoritative meeting after a stale location edit is rejected', async () => {
    incoming = [{ ...REQUEST, status: 'pending' }];
    await mount();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Change Location' })));
    fireEvent.change(screen.getByLabelText('New meeting location'), { target: { value: '92' } });
    incoming = [{ ...REQUEST }];
    respond = () => json({ success: false, error: 'The meeting location is locked after approval.' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send New Location' })));
    expect(screen.getByRole('alert')).toHaveTextContent('The meeting location is locked after approval.');
    expect(screen.queryByLabelText('New meeting location')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change Location' })).not.toBeInTheDocument();
    expect(screen.getByText('Agreed spot')).toBeVisible();
});

it('does not restore a canceled pending request from an earlier poll', async () => {
    purchases = [{ ...REQUEST, status: 'pending' }];
    await mount();
    const old = deferred(); buyerLoad = () => old.promise;
    await tick();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' })));
    await act(async () => old.resolve(json({ success: true, requests: [{ ...REQUEST, status: 'pending' }] })));
    const buyer = screen.getByRole('region', { name: 'My Purchase Requests' });
    expect(within(buyer).queryByText('Temporary meeting')).not.toBeInTheDocument();
    expect(within(buyer).getByText('You have no purchase requests yet.')).toBeVisible();
});

it('handles malformed stored timestamps without crashing or offering another check-in', async () => {
    purchases = [{ ...REQUEST, checked_in_at: 'invalid timestamp' }];
    await mount();
    expect(screen.getByText('Check-in status unavailable.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
});

it('does not describe a missing API field as an unchecked-in buyer', async () => {
    const legacy = { ...REQUEST };
    delete legacy.checked_in_at;
    purchases = [legacy]; incoming = [legacy];
    await mount();
    expect(screen.getAllByText('Check-in status unavailable.')).toHaveLength(2);
    expect(screen.queryByText('Buyer has not checked in yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Not checked in yet.')).not.toBeInTheDocument();
    purchases = [{ ...REQUEST, checked_in_at: CHECKED_AT }]; incoming = purchases;
    await tick();
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
    expect(screen.queryByText('Check-in status unavailable.')).not.toBeInTheDocument();
});
