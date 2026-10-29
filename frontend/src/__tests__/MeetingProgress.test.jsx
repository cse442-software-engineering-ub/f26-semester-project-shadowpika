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
    status: 'approved', checked_in_at: null };
const CHECKED_AT = '2026-11-06T17:03:00.000Z';
const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};
let purchases, incoming, buyerLoad, sellerLoad, respond, cancel, locations, fetchMock, hidden;
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
    fetchMock = vi.fn((url) => {
        if (url.includes('get_my_meeting_requests.php')) return Promise.resolve(buyerLoad());
        if (url.includes('get_incoming_meeting_requests.php')) return Promise.resolve(sellerLoad());
        if (url.includes('respond_meeting_request.php')) return Promise.resolve(respond());
        if (url.includes('cancel_meeting_request.php')) return Promise.resolve(cancel());
        if (url.includes('get_meeting_locations.php')) return Promise.resolve(locations());
        throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.useRealTimers());
const mount = async () => { let view; await act(async () => { view = render(<Home />); }); return view; };
const tick = async () => act(async () => vi.advanceTimersByTime(MEETING_REFRESH_MS));
const calls = (endpoint) => fetchMock.mock.calls.filter(([url]) => url.includes(endpoint));

it('shows persisted check-in for both roles in New York time, with locked addresses and no submit entry', async () => {
    purchases = [{ ...REQUEST, checked_in_at: CHECKED_AT }];
    incoming = [{ ...REQUEST, checked_in_at: CHECKED_AT }];
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
    expect(screen.getByRole('link', { name: 'Check In' })).toHaveAttribute('href', './check-in.html?request_id=71');
    purchases = [{ ...REQUEST, checked_in_at: CHECKED_AT }]; incoming = purchases;
    await tick();
    expect(screen.getByText(/Buyer checked in at/)).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Check In' })).not.toBeInTheDocument();
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
