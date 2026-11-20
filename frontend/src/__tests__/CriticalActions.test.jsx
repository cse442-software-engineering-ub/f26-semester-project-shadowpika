/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/meet.html"}
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import OrganizeMeet from '../OrganizeMeet.jsx';
import Home from '../Home.jsx';
import ManageListings from '../ManageListings.jsx';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav>Karavan</nav> }));
vi.mock('../RecommendedItems.jsx', () => ({ default: () => null }));
vi.mock('../PreviouslyViewed.jsx', () => ({ default: () => null }));

const ITEM = { listing_id: 81, name: 'Campus Lamp', price: '20.00', condition: 'Good', category: 'Other',
    description: 'A reading lamp', community: 'Karavan', status: 'active', image_url: null,
    meeting_location: 'Baldy 19', meeting_location_id: 91004, allow_offers: true,
    can_freeze: true, freeze_block_reason: null, can_mark_sold: true, sale_request_id: 71 };
const PENDING = { request_id: 71, listing_id: 81, name: ITEM.name, price: ITEM.price,
    meeting_date: '2026-12-19', meeting_time: '14:00', location: 'Baldy 19', status: 'pending',
    checked_in_at: null, seller_checked_in_at: null, listing_status: 'active' };
const READY = { ...PENDING, buyer: 'buyer@test.invalid', status: 'approved', both_checked_in: true,
    checked_in_at: '2026-12-19T19:00:00Z', buyer_checked_in_at: '2026-12-19T19:00:00Z',
    seller_checked_in_at: '2026-12-19T19:01:00Z', can_mark_sold: true };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
});
const FLOWS = [
    { name: 'send', title: 'Send this meeting request?', confirm: 'Send Request', cancel: 'Back to Edit',
        endpoint: 'create_meeting_request.php', body: { listing_id: 81, meeting_date: '2026-12-19', meeting_time: '14:00', location_id: 91004, offer_price: '15.00' } },
    { name: 'cancel', title: 'Cancel this meeting request?', confirm: 'Cancel Request', cancel: 'Keep Request',
        endpoint: 'cancel_meeting_request.php', body: { listing_id: 81 } },
    { name: 'sold on Home', title: 'Mark this listing as sold?', confirm: 'Mark as Sold', cancel: 'Keep Listing',
        endpoint: 'update_listing.php', body: { action: 'update_status', listing_id: 81, status: 'sold', request_id: 71 } },
    { name: 'sold in Manage Listings', title: 'Mark this listing as sold?', confirm: 'Mark as Sold', cancel: 'Keep Listing',
        endpoint: 'update_listing.php', body: { action: 'update_status', listing_id: 81, status: 'sold', request_id: 71 } },
    { name: 'delete', title: 'Delete this listing?', confirm: 'Delete Listing', cancel: 'Keep Listing',
        endpoint: 'update_listing.php', body: { action: 'delete', listing_id: 81 } },
];
let fetchMock, mutation, listings, purchases, incoming, assign;
beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T17:00:00Z'));
    window.history.replaceState({}, '', 'meet.html?listing_id=81');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    listings = [{ ...ITEM }]; purchases = [{ ...PENDING }]; incoming = [{ ...READY }];
    mutation = () => json({ success: true });
    assign = vi.fn();
    fetchMock = vi.fn(async (url, options = {}) => {
        const path = String(url);
        if (options.method === 'POST') return mutation(JSON.parse(options.body));
        if (path.includes('get_item_details.php')) return json({ success: true, listing: { ...ITEM } });
        if (path.includes('get_my_listings.php')) return json({ success: true, results: listings });
        if (path.includes('get_my_meeting_requests.php')) return json({ success: true, requests: purchases });
        if (path.includes('get_incoming_meeting_requests.php')) return json({ success: true, requests: incoming });
        throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
const writes = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
const settle = async (callback = () => {}) => act(async () => { callback(); });

async function openFlow(flow) {
    let view, trigger;
    if (flow.name === 'send') {
        await act(async () => { view = render(<OrganizeMeet />); });
        fireEvent.change(view.container.querySelector('[type="date"]'), { target: { value: '2026-12-19' } });
        fireEvent.change(view.container.querySelector('[type="time"]'), { target: { value: '14:00' } });
        fireEvent.click(screen.getByLabelText('Make an offer'));
        fireEvent.change(screen.getByLabelText('Your offer ($)'), { target: { value: '15.00' } });
        trigger = screen.getByRole('button', { name: 'Confirm Meeting Request' });
        const { pathname, search, hash } = window.location;
        vi.stubGlobal('location', { pathname, search, hash, assign });
    } else if (flow.name === 'cancel' || flow.name === 'sold on Home') {
        await act(async () => { view = render(<Home />); });
        trigger = screen.getByRole('button', { name: flow.name === 'cancel' ? 'Cancel Request' : 'Mark as sold', exact: true });
    } else {
        window.history.replaceState({}, '', 'manage-listings.html');
        await act(async () => { view = render(<ManageListings />); });
        trigger = screen.getByRole('button', { name: flow.name === 'delete' ? 'Delete' : 'Mark as sold', exact: true });
    }
    trigger.focus(); fireEvent.click(trigger);
    return { ...view, trigger, dialog: screen.getByRole('dialog', { name: flow.title }) };
}

for (const flow of FLOWS) {
    it.each(['cancel', 'close', 'Escape'])(`does not submit ${flow.name} when dismissed with %s`, async (how) => {
        const { dialog, trigger, container } = await openFlow(flow);
        expect(within(dialog).getByText(ITEM.name)).toBeVisible();
        expect(within(dialog).getByRole('button', { name: flow.cancel })).toHaveFocus();
        expect(writes()).toHaveLength(0);
        if (how === 'Escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
        else fireEvent.click(within(dialog).getByRole('button', { name: how === 'close' ? 'Close confirmation' : flow.cancel }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes()).toHaveLength(0);
        expect(trigger).toHaveFocus();
        if (flow.name === 'send') {
            expect(container.querySelector('[type="date"]')).toHaveValue('2026-12-19');
            expect(container.querySelector('[type="time"]')).toHaveValue('14:00');
            expect(screen.getByLabelText('Your offer ($)')).toHaveValue('15.00');
            expect(screen.getByLabelText('Meeting Location')).toHaveValue('Baldy 19');
            expect(screen.getByLabelText('Meeting Location')).toBeDisabled();
        }
    });

    it(`submits ${flow.name} once after confirmation and prevents pending dismissal`, async () => {
        let resolve;
        mutation = () => new Promise((done) => { resolve = done; });
        const { dialog } = await openFlow(flow);
        const confirm = within(dialog).getByRole('button', { name: flow.confirm, exact: true });
        fireEvent.click(confirm); fireEvent.click(confirm);
        expect(writes()).toHaveLength(1);
        const [url, options] = writes()[0];
        expect(url).toContain(flow.endpoint);
        expect(JSON.parse(options.body)).toEqual(flow.body);
        expect(within(dialog).getByRole('button', { name: 'Working…' })).toBeDisabled();
        expect(within(dialog).getByRole('button', { name: flow.cancel })).toBeDisabled();
        fireEvent(dialog, new Event('cancel', { cancelable: true }));
        expect(dialog).toBeInTheDocument();
        await settle(() => {
            if (flow.name === 'delete') listings = [];
            if (flow.name.startsWith('sold')) { listings = [{ ...ITEM, status: 'sold' }]; incoming = []; }
            if (flow.name === 'cancel') purchases = [];
            resolve(json({ success: true }));
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(writes()).toHaveLength(1);
        if (flow.name === 'send') expect(assign).toHaveBeenCalledWith(expect.stringContaining('home.html?request_sent=1'));
    });

    it(`reports a server refusal of ${flow.name} without success or losing inputs`, async () => {
        mutation = () => json({ success: false, error: 'The item changed. Reload and try again.' }, 409);
        const { dialog, container } = await openFlow(flow);
        await settle(() => fireEvent.click(within(dialog).getByRole('button', { name: flow.confirm, exact: true })));
        expect(screen.getByRole('alert')).toHaveTextContent('The item changed. Reload and try again.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(assign).not.toHaveBeenCalled();
        if (flow.name === 'send') {
            expect(container.querySelector('[type="date"]')).toHaveValue('2026-12-19');
            expect(screen.getByLabelText('Your offer ($)')).toHaveValue('15.00');
        }
        expect(screen.queryByText(/Listing deleted\.|Listing marked as sold\.|Your meeting request was canceled\./)).not.toBeInTheDocument();
    });

    it(`does not claim ${flow.name} succeeded when the connection fails`, async () => {
        mutation = () => { throw new TypeError('Connection lost'); };
        const { dialog } = await openFlow(flow);
        await settle(() => fireEvent.click(within(dialog).getByRole('button', { name: flow.confirm, exact: true })));
        expect(screen.getByRole('alert')).toHaveTextContent('Could not connect to the server.');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(assign).not.toHaveBeenCalled();
        expect(screen.queryByText(/Listing deleted\.|Listing marked as sold\.|Your meeting request was canceled\./)).not.toBeInTheDocument();
    });
}

it('keeps keyboard focus inside the native confirmation controls', async () => {
    const { dialog } = await openFlow(FLOWS[4]);
    const first = within(dialog).getByRole('button', { name: 'Close confirmation' });
    const last = within(dialog).getByRole('button', { name: 'Delete Listing' });
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' }); expect(first).toHaveFocus();
    first.focus(); fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    expect(writes()).toHaveLength(0);
});

it('rechecks a Pending request after approval arrives while its cancel dialog is open', async () => {
    const flow = FLOWS[1];
    const { dialog } = await openFlow(flow);
    purchases = [{ ...PENDING, status: 'approved' }];
    await act(async () => { vi.advanceTimersByTime(15000); });
    await settle(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel Request', exact: true })));
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('This request is no longer pending.');
});

it('rechecks sale eligibility when a new server read changes it during confirmation', async () => {
    const { dialog } = await openFlow(FLOWS[3]);
    listings = [{ ...ITEM, can_mark_sold: false }];
    await act(async () => { vi.advanceTimersByTime(15000); });
    await settle(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as Sold', exact: true })));
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('This listing is no longer available for this action.');
});
