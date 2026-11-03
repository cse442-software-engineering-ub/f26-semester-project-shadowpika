import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings, { ACCOUNT_SETTINGS_HREF } from '../pages/Settings.jsx';

// Leaflet needs a real browser, so the map is swapped for buttons that report the same events.
vi.mock('../components/LocationsMap.jsx', () => ({
    default: ({ locations, removingIds, draft, onMapClick, onSelect }) => (
        <div data-testid="locations-map">
            <button type="button" onClick={() => onMapClick({ lat: 43.00081234567, lng: -78.78901234567 })}>
                Click map spot
            </button>
            {locations.map((location) => (
                <button key={location.location_id} type="button" onClick={() => onSelect(location.location_id)}>
                    {`Pin: ${location.label} @ ${location.lat},${location.lng}${removingIds.has(location.location_id) ? ' (removing)' : ''}`}
                </button>
            ))}
            {draft && <span>{`Draft pin @ ${draft.lat},${draft.lng}`}</span>}
        </div>
    ),
}));

const FORBIDDEN = { success: false, error: 'You do not have permission to perform this action.' };
const CAPEN = { location_id: 1, lat: 42.9612, lng: -78.8328, label: 'Capen Hall Main Entrance' };

function jsonResponse(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

const JOIN_REQUEST = {
    user_id: 42,
    username: 'pmdemo',
    email: 'pmdemo3841@test.com',
    community_id: 91080,
    community_name: 'Shopping Test Hall',
};

function mockBackend({
    adminStatus = [200, { success: true, is_admin: true, application_status: 'approved' }],
    requests = [200, { success: true, requests: [] }],
    decide = [200, { success: true, user_id: 42, community_id: 91080, status: 'approved' }],
    list = [200, { success: true, locations: [CAPEN] }],
    add = [201, { success: true, location_id: 2 }],
    remove,
} = {}) {
    const fetchMock = vi.fn((url, options = {}) => {
        if (url.endsWith('admin_status.php')) return jsonResponse(...adminStatus);
        if (url.endsWith('get_join_requests.php')) return jsonResponse(...requests);
        if (url.endsWith('approve_join_request.php')) return jsonResponse(...decide);
        if (url.endsWith('get_approved_locations.php')) return jsonResponse(...list);
        if (url.endsWith('add_approved_location.php')) return jsonResponse(...add);
        if (url.endsWith('remove_approved_location.php')) {
            const { location_id } = JSON.parse(options.body);
            return jsonResponse(...(remove ?? [200, { success: true, location_id }]));
        }
        return jsonResponse(404, {});
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const callsTo = (fetchMock, file) => fetchMock.mock.calls.filter(([url]) => url.endsWith(file));

async function openAdminTab(user) {
    await user.click(await screen.findByRole('tab', { name: 'Admin' }));
}

function stubNavigation() {
    const navigation = { replace: vi.fn(), assign: vi.fn() };
    vi.stubGlobal('location', { ...window.location, ...navigation });
    return navigation;
}

describe('Settings page', () => {
    beforeEach(() => {
        stubNavigation();
    });

    it('opens on the Admin tab for admins, next to the Account tab', async () => {
        mockBackend();
        render(<Settings />);

        expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
        expect(await screen.findByRole('tab', { name: 'Admin' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Account', 'Admin']);
        expect(window.location.replace).not.toHaveBeenCalled();
    });

    it('switches to the Account settings page from the Account tab', async () => {
        const user = userEvent.setup();
        mockBackend();
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('tab', { name: 'Account' }));

        expect(window.location.assign).toHaveBeenCalledWith(ACCOUNT_SETTINGS_HREF);
    });

    it('shows every signed-in user the Admin tab with a register button', async () => {
        mockBackend({ adminStatus: [200, { success: true, is_admin: false, application_status: 'none' }] });
        render(<Settings />);

        expect(await screen.findByRole('tab', { name: 'Admin' })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Register as an admin' })).toHaveAttribute('href', expect.stringContaining('admin-register'));
        expect(window.location.replace).not.toHaveBeenCalled();
        expect(screen.queryByText('Approved Meeting Locations')).not.toBeInTheDocument();
        expect(screen.queryByTestId('locations-map')).not.toBeInTheDocument();
    });

    it('tells a pending applicant that their request is being reviewed', async () => {
        mockBackend({ adminStatus: [200, { success: true, is_admin: false, application_status: 'pending' }] });
        render(<Settings />);

        expect(await screen.findByText('Your request is being reviewed.')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Register as an admin' })).not.toBeInTheDocument();
        expect(screen.queryByTestId('locations-map')).not.toBeInTheDocument();
    });

    it('keeps the Admin tab when the admin-status request fails', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
        render(<Settings />);

        expect(await screen.findByRole('tab', { name: 'Admin' })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Register as an admin' })).toBeInTheDocument();
        expect(window.location.replace).not.toHaveBeenCalled();
    });

    // Frontend Test 1
    it('shows the Admin tab to admins with a map of the saved locations', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend();
        render(<Settings />);

        await openAdminTab(user);

        expect(await screen.findByRole('heading', { name: 'Approved Meeting Locations' })).toBeInTheDocument();
        expect(screen.getByTestId('locations-map')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pin: Capen Hall Main Entrance @ 42.9612,-78.8328' })).toBeInTheDocument();
        const locationCalls = callsTo(fetchMock, 'get_approved_locations.php');
        expect(locationCalls).not.toHaveLength(0);
        expect(locationCalls[0][0]).toMatch(/get_approved_locations\.php$/);
        expect(String(locationCalls[0][0])).not.toMatch(/[?&]community/);
    });

    it('renders the administered community locations from the server list as-is', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend({
            list: [200, { success: true, locations: [{ location_id: 1, lat: 43.0009, lng: -78.7894, label: 'Keller HQ' }] }],
        });
        render(<Settings />);

        await openAdminTab(user);

        expect(screen.getByRole('button', { name: 'Pin: Keller HQ @ 43.0009,-78.7894' })).toBeInTheDocument();
        expect(screen.queryByText(/Second Community Office/)).not.toBeInTheDocument();
        expect(callsTo(fetchMock, 'get_approved_locations.php')[0][0]).toMatch(/get_approved_locations\.php$/);
    });

    it('says so when there are no locations yet', async () => {
        const user = userEvent.setup();
        mockBackend({ list: [200, { success: true, locations: [] }] });
        render(<Settings />);

        await openAdminTab(user);

        expect(await screen.findByText('No approved meeting locations yet.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    // Frontend Test 2
    it('adds a pin where the admin clicked once they name it and save', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend({ list: [200, { success: true, locations: [] }] });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: 'Click map spot' }));
        expect(screen.getByText('Draft pin @ 43.000812,-78.789012')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Location name'), 'Student Union Lobby');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByRole('button', { name: 'Pin: Student Union Lobby @ 43.000812,-78.789012' })).toBeInTheDocument();
        const [[, options]] = callsTo(fetchMock, 'add_approved_location.php');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ lat: 43.000812, lng: -78.789012, label: 'Student Union Lobby' });
        expect(screen.queryByLabelText('Location name')).not.toBeInTheDocument();
        expect(screen.getByText('Changes saved.')).toBeInTheDocument();
    });

    it('does not save a new pin until it has a name', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend({ list: [200, { success: true, locations: [] }] });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: 'Click map spot' }));
        await user.type(screen.getByLabelText('Location name'), '   ');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Please enter a location name.');
        expect(screen.getByLabelText('Location name')).toHaveAttribute('aria-invalid', 'true');
        expect(callsTo(fetchMock, 'add_approved_location.php')).toHaveLength(0);
    });

    it('keeps the new pin and shows the server error when adding fails', async () => {
        const user = userEvent.setup();
        mockBackend({
            list: [200, { success: true, locations: [] }],
            add: [400, { success: false, error: 'Invalid location coordinates.' }],
        });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: 'Click map spot' }));
        await user.type(screen.getByLabelText('Location name'), 'Somewhere');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid location coordinates.');
        expect(screen.getByText('Draft pin @ 43.000812,-78.789012')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Pin: Somewhere/ })).not.toBeInTheDocument();
    });

    it('lets the admin cancel a new pin', async () => {
        const user = userEvent.setup();
        mockBackend({ list: [200, { success: true, locations: [] }] });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: 'Click map spot' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText(/Draft pin/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    });

    // Frontend Test 3
    it('removes a pin after the admin selects it, clicks Remove location, and saves', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend();
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: /^Pin: Capen Hall Main Entrance/ }));
        await user.click(screen.getByRole('button', { name: 'Remove location' }));
        expect(screen.getByRole('button', { name: /Capen Hall Main Entrance.*\(removing\)/ })).toBeInTheDocument();
        expect(callsTo(fetchMock, 'remove_approved_location.php')).toHaveLength(0);

        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: /Capen Hall Main Entrance/ })).not.toBeInTheDocument());
        const [[, options]] = callsTo(fetchMock, 'remove_approved_location.php');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ location_id: 1 });
        expect(screen.getByText('Changes saved.')).toBeInTheDocument();
    });

    it('treats a successful join approve as success even when the body status is approved', async () => {
        const user = userEvent.setup();
        mockBackend({ requests: [200, { success: true, requests: [JOIN_REQUEST] }] });
        render(<Settings />);

        await user.click(await screen.findByRole('button', { name: 'Approve' }));

        expect(await screen.findByRole('status')).toHaveTextContent(
            "Approved pmdemo3841@test.com's request to join Shopping Test Hall."
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByText('pmdemo3841@test.com')).not.toBeInTheDocument();
    });

    it('lets the admin undo a removal before saving', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend();
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: /^Pin: Capen Hall Main Entrance/ }));
        await user.click(screen.getByRole('button', { name: 'Remove location' }));
        await user.click(screen.getByRole('button', { name: 'Keep location' }));

        expect(screen.getByRole('button', { name: 'Pin: Capen Hall Main Entrance @ 42.9612,-78.8328' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        expect(callsTo(fetchMock, 'remove_approved_location.php')).toHaveLength(0);
    });

    it('keeps the pin and shows the error when removing fails', async () => {
        const user = userEvent.setup();
        mockBackend({ remove: [403, FORBIDDEN] });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: /^Pin: Capen Hall Main Entrance/ }));
        await user.click(screen.getByRole('button', { name: 'Remove location' }));
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to perform this action.');
        expect(screen.getByRole('button', { name: /Capen Hall Main Entrance.*\(removing\)/ })).toBeInTheDocument();
    });

    it('treats a pin that was already removed elsewhere as removed', async () => {
        const user = userEvent.setup();
        mockBackend({ remove: [404, { success: false, error: 'Location not found.' }] });
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: /^Pin: Capen Hall Main Entrance/ }));
        await user.click(screen.getByRole('button', { name: 'Remove location' }));
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(screen.queryByRole('button', { name: /Capen Hall Main Entrance/ })).not.toBeInTheDocument());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('saves a removal and a new pin together', async () => {
        const user = userEvent.setup();
        const fetchMock = mockBackend();
        render(<Settings />);
        await openAdminTab(user);

        await user.click(screen.getByRole('button', { name: /^Pin: Capen Hall Main Entrance/ }));
        await user.click(screen.getByRole('button', { name: 'Remove location' }));
        await user.click(screen.getByRole('button', { name: 'Click map spot' }));
        await user.type(screen.getByLabelText('Location name'), 'Student Union Lobby');
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(await screen.findByRole('button', { name: /^Pin: Student Union Lobby/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Capen Hall Main Entrance/ })).not.toBeInTheDocument();
        expect(callsTo(fetchMock, 'remove_approved_location.php')).toHaveLength(1);
        expect(callsTo(fetchMock, 'add_approved_location.php')).toHaveLength(1);
    });
});
