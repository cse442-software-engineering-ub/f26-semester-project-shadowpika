/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/davidjob/meet.html"}
 */
// Mirrors frontend task card #168 (Buyer Meeting Request Frontend), using the same payloads.
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import OrganizeMeet from '../OrganizeMeet.jsx';
import Home from '../Home.jsx';
import { formatMeetingDate, formatMeetingTime, meetingRequestError } from '../meetingRequests.js';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

// Answers each endpoint by file name, like a DevTools override per request.
function serve(routes) {
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((file) => String(url).includes(file));
        return match ? routes[match]() : Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

// Home also loads Requests for My Items and Recommended Items; most tests only care about My Purchase Requests.
const noIncoming = {
    'get_incoming_meeting_requests.php': () => json(200, { success: true, requests: [] }),
    'get_recommended_items.php': () => json(200, { success: true, items: [] }),
};

const callsTo = (fetchMock, file) => fetchMock.mock.calls.filter(([url]) => String(url).includes(file));

it('shows Check In only for approved meetings with their own request ID (#205)', async () => {
    serve({ ...noIncoming, 'get_my_meeting_requests.php': () => json(200, {
        success: true, requests: ['pending', 'approved', 'denied', 'location_change_requested'].map((status, index) => ({
            request_id: 700 + index, listing_id: 800 + index, name: `Meeting ${index}`, price: '12.00',
            meeting_date: '2026-11-06', meeting_time: '12:00', location: 'Test location', status,
            checked_in_at: null, seller_checked_in_at: null, listing_status: 'active',
        })),
    }) });
    render(<Home />);
    const link = await screen.findByRole('link', { name: 'Check In' });
    expect(link).toHaveAttribute('href', './check-in.html?request_id=701');
    expect(screen.getAllByRole('link', { name: 'Check In' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Cancel Request' })).toBeVisible();
});

const open = (path) => window.history.replaceState({}, '', path);

const workbook = { listing_id: 91002, name: 'Calculus Workbook', price: '20.00', condition: 'Like New', category: 'Textbooks', description: null };
const fridge = { listing_id: 91010, name: 'Dorm Fridge', price: '80.00', condition: 'Good', category: 'Dorm Living', description: null };
const locations = {
    success: true,
    locations: [
        { location_id: 91001, label: 'Capen Hall Main Entrance' },
        { location_id: 91002, label: 'Student Union Main Entrance' },
        { location_id: 91003, label: 'Lockwood Memorial Library Main Entrance' },
    ],
};

async function openMeetPage(extraRoutes = {}) {
    open('meet.html?listing_id=91002');
    const fetchMock = serve({
        'get_item_details.php': () => json(200, { success: true, listing: { ...workbook, community: 'All of UB' } }),
        'get_meeting_locations.php': () => json(200, locations),
        ...extraRoutes,
    });
    const view = render(<OrganizeMeet />);
    await screen.findByRole('option', { name: 'Capen Hall Main Entrance' });
    return { fetchMock, ...view };
}

const fill = (container, { date, time, location }) => {
    if (date !== undefined) fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: date } });
    if (time !== undefined) fireEvent.change(container.querySelector('input[type="time"]'), { target: { value: time } });
    if (location !== undefined) fireEvent.change(screen.getByLabelText('Meeting Location'), { target: { value: location } });
};

const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirm Meeting Request' }));

describe('Frontend: Buyer Meeting Request (#168)', () => {
    beforeEach(() => open('item.html?listing_id=91002'));

    it("Test 1: shows Buy Now on another student's item and opens the Organize a Meet page", async () => {
        const fetchMock = serve({
            'get_item_details.php': () => json(200, { success: true, listing: workbook }),
            'get_listing_ownership.php': () => json(200, { success: true, listing_id: 91002, is_owner: false }),
        });
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, assign, search: '?listing_id=91002' });
        render(<ItemDetails />);

        fireEvent.click(await screen.findByRole('button', { name: 'Buy Now' }));
        expect(callsTo(fetchMock, 'get_listing_ownership.php')[0][0]).toBe('./api/get_listing_ownership.php?listing_id=91002');
        expect(assign).toHaveBeenCalledWith('./meet.html?listing_id=91002');
    });

    it('Test 1: the Organize a Meet page shows the item, the form, and every approved location', async () => {
        const { fetchMock } = await openMeetPage();

        expect(screen.getByRole('heading', { name: 'Organize a Meet' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Calculus Workbook' })).toBeInTheDocument();
        expect(screen.getByText('$20.00')).toBeInTheDocument();
        expect(screen.getByLabelText('Date')).toBeInTheDocument();
        expect(screen.getByLabelText('Preferred Time')).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Student Union Main Entrance' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Lockwood Memorial Library Main Entrance' })).toBeInTheDocument();
        expect(callsTo(fetchMock, 'get_meeting_locations.php')).toHaveLength(1);
        expect(callsTo(fetchMock, 'get_meeting_locations.php')[0][0]).toContain('community=All+of+UB');
    });

    it("Test 2: hides Buy Now on the user's own item", async () => {
        open('item.html?listing_id=91010');
        const fetchMock = serve({
            'get_item_details.php': () => json(200, { success: true, listing: fridge }),
            'get_listing_ownership.php': () => json(200, { success: true, listing_id: 91010, is_owner: true }),
        });
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: 'Dorm Fridge' })).toBeInTheDocument();
        expect(screen.getByText('$80.00')).toBeInTheDocument();
        await waitFor(() => expect(callsTo(fetchMock, 'get_listing_ownership.php')).toHaveLength(1));
        expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
    });

    it('Test 3: sends exactly the entered meeting details and confirms the request was sent', async () => {
        const { fetchMock, container } = await openMeetPage({
            'create_meeting_request.php': () => json(201, { success: true, request: {} }),
        });
        fill(container, { date: '2026-12-12', time: '16:00', location: '91001' });
        confirm();

        expect(await screen.findByText('Your meeting request was sent.')).toBeInTheDocument();
        const [[, options]] = callsTo(fetchMock, 'create_meeting_request.php');
        expect(options.method).toBe('POST');
        expect(options.body).toBe('{"listing_id":91002,"meeting_date":"2026-12-12","meeting_time":"16:00","location_id":91001}');
    });

    it("Test 4: shows the server's error when the request is rejected", async () => {
        const { container } = await openMeetPage({
            'create_meeting_request.php': () => json(409, { success: false, error: 'You already have a meeting request for this item.' }),
        });
        fill(container, { date: '2026-12-13', time: '10:00', location: '91002' });
        confirm();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('You already have a meeting request for this item.');
        expect(alert).toHaveClass('id-error');
        expect(screen.queryByText('Your meeting request was sent.')).not.toBeInTheDocument();
    });

    it('Test 5: blocks missing or past meeting details before sending', async () => {
        const { fetchMock, container } = await openMeetPage();
        const expectBlocked = (text) => {
            expect(screen.getByRole('alert')).toHaveTextContent(text);
            expect(screen.getByRole('alert')).toHaveClass('id-error');
            expect(callsTo(fetchMock, 'create_meeting_request.php')).toHaveLength(0);
        };

        fill(container, { date: '2026-12-14', time: '11:00' });
        confirm();
        expectBlocked('A meeting location is required.');

        fill(container, { location: '91001', date: '' });
        confirm();
        expectBlocked('A date is required.');

        fill(container, { date: '2026-12-14', time: '' });
        confirm();
        expectBlocked('A time is required.');

        fill(container, { time: '11:00', date: '2026-01-05' });
        confirm();
        expectBlocked('The meeting date must be in the future.');
    });

    it('Test 6: links back to the item', async () => {
        await openMeetPage();
        expect(screen.getByRole('link', { name: /Back to item/ })).toHaveAttribute('href', './item.html?listing_id=91002');
    });

    it('Test 7/8: lists every request with its status, image, and formatted details in server order', async () => {
        open('home.html');
        const fetchMock = serve({
            ...noIncoming, 'get_my_meeting_requests.php': () => json(200, {
                success: true,
                requests: [
                    { listing_id: 92001, name: 'Physics Lab Manual', price: '7.50', image_url: './favicon.svg', meeting_date: '2027-01-03', meeting_time: '09:05', location: 'Capen Hall Main Entrance', status: 'pending' },
                    { listing_id: 92002, name: 'Graphing Calculator', price: '60.00', image_url: null, meeting_date: '2027-01-04', meeting_time: '12:00', location: 'Student Union Main Entrance', status: 'approved' },
                    { listing_id: 92003, name: 'Desk Chair', price: '25.00', image_url: 'uploads/missing-photo.jpg', meeting_date: '2027-01-05', meeting_time: '18:45', location: 'Lockwood Memorial Library Main Entrance', status: 'denied' },
                    { listing_id: 92004, name: 'Mini Fridge', price: '50.00', image_url: '', meeting_date: '2027-01-06', meeting_time: '00:30', location: 'Student Union Main Entrance', status: 'location_change_requested' },
                ],
            }),
        });
        const { container } = render(<Home />);

        expect(await screen.findByRole('heading', { name: 'My Purchase Requests' })).toBeInTheDocument();
        await screen.findByText('Physics Lab Manual');
        expect(callsTo(fetchMock, 'get_my_meeting_requests.php')).toHaveLength(1);

        const cards = [...container.querySelectorAll('.mr-request')].map((card) => card.querySelector('.mr-request-body').textContent);
        expect(cards).toEqual([
            'Physics Lab Manual$7.50Jan 3, 9:05 AMCapen Hall Main EntrancePendingCancel Request',
            'Graphing Calculator$60.00Jan 4, 12:00 PMStudent Union Main EntranceApprovedMeeting location locked after approval.Check-in status unavailable.Seller check-in status unavailable.',
            'Desk Chair$25.00Jan 5, 6:45 PMLockwood Memorial Library Main EntranceDenied',
            'Mini Fridge$50.00Jan 6, 12:30 AMStudent Union Main EntranceLocation Change Requested',
        ]);

        expect(screen.getByRole('img', { name: 'Physics Lab Manual listing' })).toHaveAttribute('src', './favicon.svg');
        fireEvent.error(screen.getByRole('img', { name: 'Desk Chair listing' }));
        expect(screen.getAllByRole('img')).toHaveLength(1);
        const drawn = [...container.querySelectorAll('.mr-request-cover .ps-book-title')].map((title) => title.textContent);
        expect(drawn).toEqual(['Graphing Calculator', 'Desk Chair', 'Mini Fridge']);
    });

    it("Test 9: shows the empty list message, then the server's error", async () => {
        open('home.html');
        serve({ ...noIncoming, 'get_my_meeting_requests.php': () => json(200, { success: true, requests: [] }) });
        const { container, unmount } = render(<Home />);

        expect(await screen.findByText('You have no purchase requests yet.')).toBeInTheDocument();
        expect(container.querySelector('.mr-request')).toBeNull();
        unmount();

        serve({ ...noIncoming, 'get_my_meeting_requests.php': () => json(200, { success: false, error: 'Unable to load your purchase requests.' }) });
        const second = render(<Home />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Unable to load your purchase requests.');
        expect(alert).toHaveClass('id-error');
        expect(second.container.querySelector('.mr-request')).toBeNull();
    });

    const homeRequest = (listing_id, name, status) => ({
        listing_id, name, price: '20.00', image_url: null, meeting_date: '2026-12-12', meeting_time: '16:00', location: 'Capen Hall Main Entrance', status,
    });

    it('Test 3: cancels a pending request, sending exactly its listing, and removes it from the list', async () => {
        open('home.html');
        const fetchMock = serve({
            ...noIncoming, 'get_my_meeting_requests.php': () => json(200, {
                success: true,
                requests: [homeRequest(91001, 'Calculus Textbook', 'approved'), homeRequest(91002, 'Calculus Workbook', 'pending')],
            }),
            'cancel_meeting_request.php': () => json(200, { success: true }),
        });
        render(<Home />);

        fireEvent.click(await screen.findByRole('button', { name: 'Cancel Request' }));

        expect(await screen.findByText('Your meeting request was canceled.')).toBeInTheDocument();
        const [[url, options]] = callsTo(fetchMock, 'cancel_meeting_request.php');
        expect(url).toBe('./api/cancel_meeting_request.php');
        expect(options.method).toBe('POST');
        expect(options.body).toBe('{"listing_id":91002}');
        expect(screen.queryByRole('heading', { name: 'Calculus Workbook' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
    });

    it("Test 10: shows Cancel Request only on pending requests and the server's error when a cancel is refused", async () => {
        open('home.html');
        const fetchMock = serve({
            ...noIncoming, 'get_my_meeting_requests.php': () => json(200, {
                success: true,
                requests: [
                    homeRequest(91001, 'Calculus Textbook', 'pending'),
                    homeRequest(91002, 'Calculus Workbook', 'approved'),
                    homeRequest(91007, 'Campbell Biology', 'location_change_requested'),
                    homeRequest(91003, 'Desk Lamp', 'denied'),
                ],
            }),
            'cancel_meeting_request.php': () => json(404, { success: false, error: 'You have no pending meeting request for this item.' }),
        });
        const { container } = render(<Home />);

        await screen.findByRole('heading', { name: 'Calculus Textbook' });
        const buttons = screen.getAllByRole('button', { name: 'Cancel Request' });
        expect(buttons).toHaveLength(1);
        expect(container.querySelector('.mr-request').contains(buttons[0])).toBe(true);

        fireEvent.click(buttons[0]);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('You have no pending meeting request for this item.');
        expect(alert).toHaveClass('id-error');
        expect(callsTo(fetchMock, 'cancel_meeting_request.php')[0][1].body).toBe('{"listing_id":91001}');
        expect(screen.queryByText('Your meeting request was canceled.')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Calculus Textbook' })).toBeInTheDocument();
    });
});

describe('Frontend: Seller Meeting Request Response (#178)', () => {
    const incoming = (request_id, name, status, extra = {}) => ({
        request_id, listing_id: 91000 + request_id, name, price: '20.00', image_url: null, community: 'University at Buffalo', buyer: 'Chun Buyer',
        meeting_date: '2026-12-11', meeting_time: '13:00', location: 'Capen Hall Main Entrance', status, ...extra,
    });
    const pendingOne = incoming(91061, 'Calculus Textbook', 'pending');
    const pendingTwo = incoming(91062, 'Desk Lamp', 'pending');
    const names = (labels) => labels.map((label) => screen.queryByRole('button', { name: label }));

    // Home with the given incoming requests; extra routes answer respond_meeting_request.php and get_meeting_locations.php.
    async function openHome(requests, extraRoutes = {}) {
        open('home.html');
        const fetchMock = serve({
            'get_my_meeting_requests.php': () => json(200, { success: true, requests: [] }),
            'get_recommended_items.php': () => json(200, { success: true, items: [] }),
            'get_incoming_meeting_requests.php': () => json(200, { success: true, requests }),
            ...extraRoutes,
        });
        const view = render(<Home />);
        await screen.findByRole('heading', { name: 'Requests for My Items' });
        return { fetchMock, ...view };
    }

    const bodyOf = (fetchMock) => callsTo(fetchMock, 'respond_meeting_request.php')[0][1].body;
    const lastCard = (container) => container.querySelectorAll('.mr-request')[1];

    it('lists the requests in server order with buttons only on pending ones', async () => {
        const { container } = await openHome([
            pendingOne,
            incoming(91063, 'Mini Fridge', 'approved', { location: 'Student Union Main Entrance' }),
            incoming(91064, 'Desk Chair', 'denied'),
            incoming(91065, 'Graphing Calculator', 'location_change_requested'),
        ]);
        await screen.findByRole('heading', { name: 'Calculus Textbook' });

        const cards = [...container.querySelectorAll('.mr-request')].map((card) => card.querySelector('.mr-request-body').textContent);
        expect(cards).toEqual([
            'Calculus Textbook$20.00Requested by Chun BuyerDec 11, 1:00 PMCapen Hall Main EntrancePendingApproveDenyChange Location',
            'Mini Fridge$20.00Requested by Chun BuyerDec 11, 1:00 PMStudent Union Main EntranceApprovedMeeting location locked after approval.Check-in status unavailable.Seller check-in status unavailable.',
            'Desk Chair$20.00Requested by Chun BuyerDec 11, 1:00 PMCapen Hall Main EntranceDenied',
            'Graphing Calculator$20.00Requested by Chun BuyerDec 11, 1:00 PMCapen Hall Main EntranceLocation Change Requested',
        ]);
        expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    });

    it('shows the empty message without hiding My Purchase Requests', async () => {
        await openHome([]);
        expect(screen.getByText('No one has requested your items yet.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'My Purchase Requests' })).toBeInTheDocument();
    });

    it("shows the server's load error in orange-red without hiding My Purchase Requests", async () => {
        open('home.html');
        serve({
            'get_my_meeting_requests.php': () => json(200, { success: true, requests: [] }),
            'get_recommended_items.php': () => json(200, { success: true, items: [] }),
            'get_incoming_meeting_requests.php': () => json(200, { success: false }),
        });
        render(<Home />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Unable to load requests for your items.');
        expect(alert).toHaveClass('id-error');
        expect(screen.getByText('You have no purchase requests yet.')).toBeInTheDocument();
    });

    it('approves a request, sending exactly its id, and removes its buttons', async () => {
        const { fetchMock } = await openHome([pendingOne, pendingTwo], {
            'respond_meeting_request.php': () => json(200, { success: true, request: { ...pendingOne, status: 'approved' } }),
        });
        fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);

        expect(await screen.findByText('You approved the meeting request.')).toBeInTheDocument();
        expect(callsTo(fetchMock, 'respond_meeting_request.php')[0][1].method).toBe('POST');
        expect(bodyOf(fetchMock)).toBe('{"request_id":91061,"action":"approve"}');
        expect(screen.getByText('Approved')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1);
    });

    it('denies a request, sending exactly its id, and removes its buttons', async () => {
        const { fetchMock, container } = await openHome([pendingOne, pendingTwo], {
            'respond_meeting_request.php': () => json(200, { success: true, request: { ...pendingTwo, status: 'denied' } }),
        });
        await screen.findByRole('heading', { name: 'Desk Lamp' });
        fireEvent.click(screen.getAllByRole('button', { name: 'Deny' })[1]);

        expect(await screen.findByText('You denied the meeting request.')).toBeInTheDocument();
        expect(bodyOf(fetchMock)).toBe('{"request_id":91062,"action":"deny"}');
        expect(lastCard(container)).toHaveTextContent('Denied');
        expect(lastCard(container).querySelector('button')).toBeNull();
    });

    it("shows the server's error in orange-red and leaves the request pending with its buttons", async () => {
        await openHome([pendingOne], {
            'respond_meeting_request.php': () => json(409, { success: false, error: 'Only pending requests can be answered.' }),
        });
        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Only pending requests can be answered.');
        expect(alert).toHaveClass('id-error');
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(names(['Approve', 'Deny', 'Change Location']).every(Boolean)).toBe(true);
    });

    it('offers only the other approved locations, blocks sending without a choice, and restores the buttons on Cancel', async () => {
        const { fetchMock } = await openHome([pendingOne], {
            'get_meeting_locations.php': () => json(200, locations),
        });
        fireEvent.click(await screen.findByRole('button', { name: 'Change Location' }));

        const select = await screen.findByLabelText('New meeting location');
        expect(callsTo(fetchMock, 'get_meeting_locations.php')[0][0]).toContain('community=University+at+Buffalo');
        expect(select).toHaveValue('');
        expect([...select.options].map((option) => option.textContent)).toEqual([
            'Select a location', 'Student Union Main Entrance', 'Lockwood Memorial Library Main Entrance',
        ]);
        expect(names(['Approve', 'Deny', 'Change Location']).some(Boolean)).toBe(false);

        fireEvent.click(screen.getByRole('button', { name: 'Send New Location' }));
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Select a different meeting location.');
        expect(alert).toHaveClass('id-error');
        expect(callsTo(fetchMock, 'respond_meeting_request.php')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByLabelText('New meeting location')).not.toBeInTheDocument();
        expect(names(['Approve', 'Deny', 'Change Location']).every(Boolean)).toBe(true);
    });

    it('sends the chosen location, shows the new location, and sets Location Change Requested', async () => {
        const atUnion = { ...pendingTwo, location: 'Student Union Main Entrance' };
        const { fetchMock } = await openHome([atUnion], {
            'get_meeting_locations.php': () => json(200, locations),
            'respond_meeting_request.php': () => json(200, {
                success: true,
                request: { ...atUnion, location: 'Capen Hall Main Entrance', status: 'location_change_requested' },
            }),
        });
        fireEvent.click(await screen.findByRole('button', { name: 'Change Location' }));
        fireEvent.change(await screen.findByLabelText('New meeting location'), { target: { value: '91001' } });
        fireEvent.click(screen.getByRole('button', { name: 'Send New Location' }));

        expect(await screen.findByText('You requested a different meeting location.')).toBeInTheDocument();
        expect(bodyOf(fetchMock)).toBe('{"request_id":91062,"action":"change_location","location_id":91001}');
        expect(screen.getByText('Location Change Requested')).toBeInTheDocument();
        expect(screen.queryByLabelText('New meeting location')).not.toBeInTheDocument();
        expect(names(['Approve', 'Deny', 'Change Location', 'Send New Location']).some(Boolean)).toBe(false);
    });

    it("shows an error when the meeting locations can't be loaded", async () => {
        await openHome([pendingOne], {
            'get_meeting_locations.php': () => json(400, { success: false }),
        });
        fireEvent.click(await screen.findByRole('button', { name: 'Change Location' }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('The meeting locations could not be loaded.');
        expect(alert).toHaveClass('id-error');
    });
});

describe('meeting request helpers', () => {
    it('formats dates and 12-hour times', () => {
        expect(formatMeetingDate('2026-12-08')).toBe('Dec 8');
        expect(formatMeetingTime('14:30')).toBe('2:30 PM');
        expect(formatMeetingTime('12:00')).toBe('12:00 PM');
        expect(formatMeetingTime('00:30')).toBe('12:30 AM');
    });

    it('rejects today and accepts tomorrow', () => {
        const details = { time: '11:00', locationId: '91001' };
        expect(meetingRequestError({ ...details, date: '2026-10-06' }, '2026-10-06')).toBe('The meeting date must be in the future.');
        expect(meetingRequestError({ ...details, date: '2026-10-07' }, '2026-10-06')).toBe('');
    });
});
