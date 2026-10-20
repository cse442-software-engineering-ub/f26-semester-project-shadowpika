import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateListing from '../features/listings/CreateListing.jsx';

const ALL_OF_UB = 'All of UB';
const KELLER = 'Keller Properties LLC';
const CAPEN = { location_id: 91001, label: 'Capen Hall Main Entrance' };
const UNION = { location_id: 91002, label: 'Student Union Main Entrance' };
const KELLER_OFFICE = { location_id: 92001, label: 'Keller Community Office' };

const jsonResponse = (status, body) => Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
}));

function mockBackend() {
    const backend = {
        communities: [200, {
            success: true,
            communities: [{ name: ALL_OF_UB }, { name: KELLER }],
            joined_community_id: null,
        }],
        locations: {
            [ALL_OF_UB]: [200, { success: true, locations: [CAPEN, UNION] }],
            [KELLER]: [200, { success: true, locations: [KELLER_OFFICE] }],
        },
        upload: [200, {
            success: true,
            image_url: 'listing/api/image.php?file=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
        }],
        create: [201, {
            success: true,
            listing: {
                listing_id: 9901741,
                name: 'Community Listing Test Book',
                community: ALL_OF_UB,
                meeting_location: CAPEN.label,
            },
        }],
    };

    backend.fetch = vi.fn((input) => {
        const url = String(input);
        if (url.endsWith('list_communities.php')) return jsonResponse(...backend.communities);
        if (url.includes('api/get_meeting_locations.php?')) {
            const community = new URL(url, 'https://aptitude.test/').searchParams.get('community');
            return jsonResponse(...(backend.locations[community] || [404, { success: false, error: 'Community not found.' }]));
        }
        if (url.endsWith('listing/api/upload_image.php')) return jsonResponse(...backend.upload);
        if (url.endsWith('listing/api/create_listing.php')) return jsonResponse(...backend.create);
        return jsonResponse(404, { success: false, error: 'Unexpected test request.' });
    });
    vi.stubGlobal('fetch', backend.fetch);
    return backend;
}

const callsContaining = (fetchMock, text) => fetchMock.mock.calls.filter(([url]) => String(url).includes(text));

function stubBrowser() {
    vi.stubGlobal('location', {
        ...window.location,
        hostname: 'aptitude.cse.buffalo.edu',
        pathname: '/CSE442/2026-Fall/cse-442j/sell.html',
        assign: vi.fn(),
    });
    const BrowserURL = class extends URL {};
    BrowserURL.createObjectURL = vi.fn(() => 'blob:community-listing-test');
    BrowserURL.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', BrowserURL);
}

const communitySelect = () => screen.getByLabelText(/COMMUNITY/);
const locationSelect = () => screen.getByLabelText(/PREFERRED MEETING LOCATION/);

async function chooseCommunityAndLocation(user, community = ALL_OF_UB, location = CAPEN.label) {
    await waitFor(() => expect(communitySelect()).toBeEnabled());
    await user.selectOptions(communitySelect(), community);
    await waitFor(() => expect(locationSelect()).toBeEnabled());
    await user.selectOptions(locationSelect(), location);
}

async function fillValidListing(user) {
    await user.type(screen.getByLabelText(/ITEM TITLE/), 'Community Listing Test Book');
    await user.selectOptions(screen.getByLabelText(/CATEGORY/), 'Textbooks');
    await user.selectOptions(screen.getByLabelText(/CONDITION/), 'Good');
    await user.type(screen.getByLabelText(/PRICE/), '25.00');
    await user.type(screen.getByLabelText(/RELATED COURSE/), 'CSE 442');
    await user.type(screen.getByLabelText(/DESCRIPTION/), 'Community listing frontend test item.');
    const image = new File(['test image'], 'Community Listing Test.jpg', { type: 'image/jpeg' });
    await user.upload(document.querySelector('input[type="file"]'), image);
}

describe('Create listing Community selection', () => {
    beforeEach(() => {
        localStorage.clear();
        stubBrowser();
    });

    it('loads approved Communities once and keeps locations disabled until selection', async () => {
        const backend = mockBackend();
        render(<CreateListing />);

        await waitFor(() => expect(communitySelect()).toBeEnabled());
        expect(communitySelect()).toHaveValue('');
        expect(within(communitySelect()).getAllByRole('option', { name: ALL_OF_UB })).toHaveLength(1);
        expect(within(communitySelect()).getAllByRole('option', { name: KELLER })).toHaveLength(1);
        expect(within(communitySelect()).queryByRole('option', { name: 'all of ub' })).not.toBeInTheDocument();
        expect(locationSelect()).toBeDisabled();
        expect(locationSelect()).toHaveDisplayValue('Select a community first');
        expect(callsContaining(backend.fetch, 'list_communities.php')).toHaveLength(1);
        expect(callsContaining(backend.fetch, 'get_meeting_locations.php')).toHaveLength(0);
    });

    it('requests the exact Community name and shows only its mocked locations', async () => {
        const backend = mockBackend();
        const user = userEvent.setup();
        render(<CreateListing />);

        await waitFor(() => expect(communitySelect()).toBeEnabled());
        await user.selectOptions(communitySelect(), ALL_OF_UB);

        await waitFor(() => expect(locationSelect()).toBeEnabled());
        expect(within(locationSelect()).getByRole('option', { name: CAPEN.label })).toBeInTheDocument();
        expect(within(locationSelect()).getByRole('option', { name: UNION.label })).toBeInTheDocument();
        expect(within(locationSelect()).queryByRole('option', { name: KELLER_OFFICE.label })).not.toBeInTheDocument();
        const [[requestUrl, requestOptions]] = callsContaining(backend.fetch, 'get_meeting_locations.php');
        expect(requestOptions).toEqual({ credentials: 'same-origin' });
        expect(new URL(String(requestUrl), 'https://aptitude.test/').searchParams.get('community')).toBe(ALL_OF_UB);
    });

    it('clears the old location and replaces its options when Community changes', async () => {
        mockBackend();
        const user = userEvent.setup();
        render(<CreateListing />);

        await chooseCommunityAndLocation(user);
        expect(locationSelect()).toHaveValue(String(CAPEN.location_id));

        await user.selectOptions(communitySelect(), KELLER);
        expect(locationSelect()).toHaveValue('');
        await waitFor(() => expect(locationSelect()).toBeEnabled());
        expect(within(locationSelect()).getByRole('option', { name: KELLER_OFFICE.label })).toBeInTheDocument();
        expect(within(locationSelect()).queryByRole('option', { name: CAPEN.label })).not.toBeInTheDocument();
    });

    it('requires Community before uploading or creating a listing', async () => {
        const backend = mockBackend();
        const user = userEvent.setup();
        render(<CreateListing />);

        await waitFor(() => expect(communitySelect()).toBeEnabled());
        await fillValidListing(user);
        await user.click(screen.getByRole('button', { name: 'Create listing' }));

        expect(await screen.findByText('Community is required.')).toBeVisible();
        expect(screen.getByText('Preferred meeting location is required.')).toBeVisible();
        expect(communitySelect()).toHaveFocus();
        expect(callsContaining(backend.fetch, 'upload_image.php')).toHaveLength(0);
        expect(callsContaining(backend.fetch, 'create_listing.php')).toHaveLength(0);
    });

    it('shows empty and failed location responses without stale options', async () => {
        const backend = mockBackend();
        backend.locations[ALL_OF_UB] = [200, { success: true, locations: [] }];
        const user = userEvent.setup();
        const { unmount } = render(<CreateListing />);

        await waitFor(() => expect(communitySelect()).toBeEnabled());
        await user.selectOptions(communitySelect(), ALL_OF_UB);
        expect(await screen.findByText('No approved meeting locations are available for this community.')).toBeVisible();
        expect(locationSelect()).toBeDisabled();
        unmount();

        backend.locations[ALL_OF_UB] = [404, { success: false, error: 'Community not found.' }];
        render(<CreateListing />);
        await waitFor(() => expect(communitySelect()).toBeEnabled());
        await user.selectOptions(communitySelect(), ALL_OF_UB);
        expect(await screen.findByText('Community not found.')).toBeVisible();
        expect(within(locationSelect()).queryByRole('option', { name: CAPEN.label })).not.toBeInTheDocument();
    });

    it('shows a mocked Community-list failure without stale options', async () => {
        const backend = mockBackend();
        backend.communities = [400, { success: false, error: 'Community list test error.' }];
        render(<CreateListing />);

        expect(await screen.findByText('Community list test error.')).toBeVisible();
        expect(communitySelect()).toBeDisabled();
        expect(within(communitySelect()).queryByRole('option', { name: ALL_OF_UB })).not.toBeInTheDocument();
    });

    it('uploads first and sends the exact Community and location ID when publishing', async () => {
        const backend = mockBackend();
        const user = userEvent.setup();
        render(<CreateListing />);

        await chooseCommunityAndLocation(user);
        await fillValidListing(user);
        await user.click(screen.getByRole('button', { name: 'Create listing' }));

        await waitFor(() => expect(location.assign).toHaveBeenCalledWith('./product-search.html?published=9901741'));
        const uploadCall = backend.fetch.mock.calls.findIndex(([url]) => String(url).endsWith('upload_image.php'));
        const createCall = backend.fetch.mock.calls.findIndex(([url]) => String(url).endsWith('create_listing.php'));
        expect(uploadCall).toBeGreaterThan(-1);
        expect(createCall).toBeGreaterThan(uploadCall);
        const [, createOptions] = backend.fetch.mock.calls[createCall];
        expect(createOptions.method).toBe('POST');
        expect(createOptions.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(JSON.parse(createOptions.body)).toEqual({
            title: 'Community Listing Test Book',
            category: 'Textbooks',
            condition: 'Good',
            price: '25.00',
            related_course: 'CSE 442',
            community: ALL_OF_UB,
            meeting_location_id: CAPEN.location_id,
            description: 'Community listing frontend test item.',
            image_url: 'listing/api/image.php?file=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
        });
    });

    it('does not send create-listing when the mocked image upload fails', async () => {
        const backend = mockBackend();
        backend.upload = [400, { success: false, error: 'Image upload test error.' }];
        const user = userEvent.setup();
        render(<CreateListing />);

        await chooseCommunityAndLocation(user);
        await fillValidListing(user);
        await user.click(screen.getByRole('button', { name: 'Create listing' }));

        expect(await screen.findByText('Image upload test error.')).toBeVisible();
        expect(callsContaining(backend.fetch, 'create_listing.php')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Create listing' })).toBeEnabled();
        expect(location.assign).not.toHaveBeenCalled();
    });

    it.each([
        [422, 'The selected location is not available for this community.'],
        [404, 'Community not found.'],
    ])('keeps the form open and editable when mocked creation returns %s', async (status, message) => {
        const backend = mockBackend();
        backend.create = [status, {
            success: false,
            error: message,
        }];
        const user = userEvent.setup();
        render(<CreateListing />);

        await chooseCommunityAndLocation(user);
        await fillValidListing(user);
        await user.click(screen.getByRole('button', { name: 'Create listing' }));

        expect(await screen.findByText(message)).toBeVisible();
        expect(screen.getByRole('button', { name: 'Create listing' })).toBeEnabled();
        expect(communitySelect()).toHaveValue(ALL_OF_UB);
        expect(locationSelect()).toHaveValue(String(CAPEN.location_id));
        expect(location.assign).not.toHaveBeenCalled();
    });
});
