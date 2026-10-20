import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavBar from '../NavBar.jsx';
import App from '../App.jsx';
import { markNewAccount, openCommunityPicker, recordLogin } from '../community.js';

const ALL_OF_UB = { community_id: 91070, name: 'All of UB', automatic: true };
const KELLER = { community_id: 1, name: 'Keller Properties LLC', automatic: false };
const RIVERSIDE = { community_id: 2, name: 'Riverside Apartments', automatic: false };
const FORBIDDEN = { success: false, error: 'You do not have permission to perform this action.' };

const jsonResponse = (status, body) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

// Behaves like the real endpoints: joins and leaves change what list_communities.php returns.
// Any response can be replaced mid-test, like the DevTools network overrides in the manual cards.
function mockBackend({ communities = [ALL_OF_UB, KELLER], joined = [] } = {}) {
    const backend = {
        communities,
        joined: new Set(joined),
        list: null,
        join: null,
        leave: null,
    };
    const listBody = () => ({
        success: true,
        communities: backend.communities.map((c) => {
            const isIn = c.automatic || backend.joined.has(c.community_id);
            return { ...c, joined: isIn, shopping: isIn };
        }),
    });
    backend.fetch = vi.fn((url, options = {}) => {
        if (url.endsWith('list_communities.php')) return jsonResponse(...(backend.list ?? [200, listBody()]));
        if (url.endsWith('join_community.php')) {
            if (backend.join) return jsonResponse(...backend.join);
            const id = JSON.parse(options.body).community_id;
            backend.joined.add(id);
            const community = backend.communities.find((c) => c.community_id === id);
            return jsonResponse(200, { success: true, community_id: id, community_name: community.name });
        }
        if (url.endsWith('leave_community.php')) {
            if (backend.leave) return jsonResponse(...backend.leave);
            const id = JSON.parse(options.body).community_id;
            backend.joined.delete(id);
            const community = backend.communities.find((c) => c.community_id === id);
            return jsonResponse(200, { success: true, community_id: id, community_name: community.name });
        }
        return jsonResponse(404, { success: false });
    });
    vi.stubGlobal('fetch', backend.fetch);
    return backend;
}

const callsTo = (fetchMock, file) => fetchMock.mock.calls.filter(([url]) => url.endsWith(file));
// The mobile drawer repeats the button; jsdom has no CSS, so look inside the desktop bar.
const navBar = () => within(screen.getByRole('navigation', { name: 'Main' }));
const navButton = (name) => navBar().findByRole('button', { name });

function firstLoginAfterSignUp(email = 'riley.student@test.com') {
    markNewAccount(email);
    recordLogin(email, { success: true, role: 'user', communities: [] });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    localStorage.clear();
});

describe('Join a Community', () => {
    it('Test 1: shows the suggestions dialog automatically on the first login after signing up', async () => {
        mockBackend();
        firstLoginAfterSignUp();
        render(<NavBar />);

        const dialog = await screen.findByRole('dialog', { name: 'Suggested communities' });
        expect(within(dialog).getByText('Keller Properties LLC')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Join Keller Properties LLC' })).toHaveTextContent('Join');
        expect(within(dialog).getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    });

    it('Test 1: only shows the suggestions once', async () => {
        mockBackend();
        firstLoginAfterSignUp();
        const { unmount } = render(<NavBar />);
        await screen.findByRole('dialog');
        unmount();

        render(<NavBar />);

        await navButton('Join a Community');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not show the suggestions for an account that did not just sign up', async () => {
        mockBackend();
        markNewAccount('someone.else@test.com');
        recordLogin('riley.student@test.com', { success: true, role: 'user', communities: [] });
        render(<NavBar />);

        await navButton('Join a Community');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Test 2: joining from the dialog closes it and shows the community on the nav button', async () => {
        const backend = mockBackend();
        firstLoginAfterSignUp('morgan.joiner@test.com');
        const user = userEvent.setup();
        render(<NavBar />);

        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Join Keller Properties LLC' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(await navButton('Keller Properties LLC')).toBeInTheDocument();
        expect(navBar().queryByRole('button', { name: 'Join a Community' })).not.toBeInTheDocument();
        const [[, options]] = callsTo(backend.fetch, 'join_community.php');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ community_id: 1 });
    });

    it('Test 3: "Skip for now" closes the dialog without joining', async () => {
        const backend = mockBackend();
        firstLoginAfterSignUp('jordan.skip@test.com');
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await screen.findByRole('button', { name: 'Skip for now' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(callsTo(backend.fetch, 'join_community.php')).toHaveLength(0);
        expect(await navButton('Join a Community')).toBeInTheDocument();
    });

    it('Test 4: the nav button reopens the picker and reloads the list', async () => {
        const backend = mockBackend({ communities: [] });
        const user = userEvent.setup();
        render(<NavBar />);
        const button = await navButton('Join a Community');

        backend.communities = [KELLER];
        await user.click(button);

        const dialog = await screen.findByRole('dialog', { name: 'Join a Community' });
        expect(await within(dialog).findByText('Keller Properties LLC')).toBeInTheDocument();
        expect(callsTo(backend.fetch, 'list_communities.php')).toHaveLength(2);
    });

    it('Test 4: the nav button still works while the first-login suggestions are open', async () => {
        const backend = mockBackend({ communities: [] });
        firstLoginAfterSignUp('sam.reopen@test.com');
        const user = userEvent.setup();
        render(<NavBar />);
        await screen.findByRole('dialog', { name: 'Suggested communities' });

        backend.communities = [KELLER];
        await user.click(await navButton('Join a Community'));

        const dialog = await screen.findByRole('dialog', { name: 'Join a Community' });
        expect(await within(dialog).findByText('Keller Properties LLC')).toBeInTheDocument();
    });

    it('Test 5: joining a second community keeps the first and the nav button counts both', async () => {
        const backend = mockBackend({ communities: [ALL_OF_UB, KELLER, RIVERSIDE] });
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Join a Community'));
        await user.click(await screen.findByRole('button', { name: 'Join Keller Properties LLC' }));
        await user.click(await navButton('Keller Properties LLC'));
        const dialog = await screen.findByRole('dialog');
        expect(await within(dialog).findByRole('button', { name: 'Joined Keller Properties LLC' })).toBeDisabled();
        await user.click(within(dialog).getByRole('button', { name: 'Join Riverside Apartments' }));

        expect(await navButton('2 Communities')).toBeInTheDocument();
        await user.click(await navButton('2 Communities'));
        const reopened = await screen.findByRole('dialog');
        expect(await within(reopened).findByRole('button', { name: 'Joined Keller Properties LLC' })).toBeDisabled();
        expect(within(reopened).getByRole('button', { name: 'Joined Riverside Apartments' })).toBeDisabled();
        expect(callsTo(backend.fetch, 'join_community.php').map(([, o]) => JSON.parse(o.body))).toEqual([{ community_id: 1 }, { community_id: 2 }]);
    });

    it('shows All of UB as a community everyone is in, with no Join or Leave', async () => {
        mockBackend();
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Join a Community'));
        const dialog = await screen.findByRole('dialog');

        expect(await within(dialog).findByText('Everyone is a member')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Joined All of UB' })).toBeDisabled();
        expect(within(dialog).queryByRole('button', { name: 'Leave All of UB' })).not.toBeInTheDocument();
    });

    it('shows the joined communities from the last login on every page load', async () => {
        mockBackend({ communities: [ALL_OF_UB, KELLER, RIVERSIDE], joined: [2] });
        recordLogin('casey.switch@test.com', { success: true, role: 'user', communities: [{ community_id: 2, name: 'Riverside Apartments' }] });

        render(<NavBar />);

        expect(await navButton('Riverside Apartments')).toBeInTheDocument();
    });

    it('forgets the joined communities when the user logs out', async () => {
        mockBackend({ communities: [ALL_OF_UB, KELLER, RIVERSIDE], joined: [2] });
        recordLogin('casey.switch@test.com', { success: true, role: 'user', communities: [{ community_id: 2, name: 'Riverside Apartments' }] });
        const user = userEvent.setup();
        render(<NavBar />);
        await navButton('Riverside Apartments');
        expect(localStorage.getItem('karavan_communities')).not.toBeNull();

        await user.click(navBar().getByRole('button', { name: 'Log Out' }));

        await waitFor(() => expect(localStorage.getItem('karavan_communities')).toBeNull());
    });

    it('keeps the dialog open with the error when joining fails', async () => {
        const backend = mockBackend();
        backend.join = [404, { success: false, error: 'Community not found.' }];
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Join a Community'));
        await user.click(await screen.findByRole('button', { name: 'Join Keller Properties LLC' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Community not found.');
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(navBar().getByRole('button', { name: 'Join a Community' })).toBeInTheDocument();
    });

    it('hides the button from signed-out visitors', async () => {
        const backend = mockBackend();
        backend.list = [403, FORBIDDEN];
        firstLoginAfterSignUp();
        render(<NavBar />);

        await waitFor(() => expect(callsTo(backend.fetch, 'list_communities.php')).toHaveLength(1));
        expect(screen.queryByRole('button', { name: /community/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens when another page asks for it (the search page\'s "Join a community")', async () => {
        mockBackend();
        render(<NavBar />);
        await navButton('Join a Community');

        openCommunityPicker();

        expect(await screen.findByRole('dialog', { name: 'Join a Community' })).toBeInTheDocument();
    });

    // Leave a Community frontend
    it('leaving one community keeps the others and sends which one to leave', async () => {
        const backend = mockBackend({ communities: [ALL_OF_UB, KELLER, RIVERSIDE], joined: [1, 2] });
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('2 Communities'));
        const dialog = await screen.findByRole('dialog', { name: 'Join a Community' });
        await user.click(await within(dialog).findByRole('button', { name: 'Leave Keller Properties LLC' }));

        expect(await navButton('Riverside Apartments')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Join Keller Properties LLC' })).toBeEnabled();
        expect(within(dialog).getByRole('button', { name: 'Leave Riverside Apartments' })).toBeInTheDocument();
        const [[, options]] = callsTo(backend.fetch, 'leave_community.php');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ community_id: 1 });
    });

    it('leaving the last joined community goes back to "Join a Community"', async () => {
        mockBackend({ joined: [1] });
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Keller Properties LLC'));
        await user.click(await screen.findByRole('button', { name: 'Leave Keller Properties LLC' }));

        expect(await navButton('Join a Community')).toBeInTheDocument();
        expect(localStorage.getItem('karavan_communities')).toBeNull();
    });

    it('only offers Leave for communities the user joined', async () => {
        mockBackend({ communities: [ALL_OF_UB, KELLER, RIVERSIDE], joined: [2] });
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Riverside Apartments'));
        const dialog = await screen.findByRole('dialog');

        expect(await within(dialog).findByRole('button', { name: 'Leave Riverside Apartments' })).toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Leave Keller Properties LLC' })).not.toBeInTheDocument();
    });

    it('keeps the community and shows the error when leaving fails', async () => {
        const backend = mockBackend({ joined: [1] });
        backend.leave = [500, { success: false, error: 'Could not leave the community.' }];
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Keller Properties LLC'));
        await user.click(await screen.findByRole('button', { name: 'Leave Keller Properties LLC' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not leave the community.');
        expect(navBar().getByRole('button', { name: 'Keller Properties LLC' })).toBeInTheDocument();
    });

    it('trusts the server about which communities the user is in', async () => {
        mockBackend();
        recordLogin('casey.stale@test.com', { success: true, role: 'user', communities: [{ community_id: 1, name: KELLER.name }] });

        render(<NavBar />);

        expect(await navButton('Join a Community')).toBeInTheDocument();
        expect(localStorage.getItem('karavan_communities')).toBeNull();
    });

    it('says so when there are no communities yet', async () => {
        mockBackend({ communities: [] });
        const user = userEvent.setup();
        render(<NavBar />);

        await user.click(await navButton('Join a Community'));

        expect(await screen.findByText(/No communities yet/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
});

describe('Sign up and log in remember the account for the community picker', () => {
    beforeEach(() => vi.stubEnv('VITE_LOCAL_BACKEND', 'true'));

    it('a sign-up followed by that account logging in queues the suggestions', async () => {
        window.history.replaceState({}, '', '/register.html');
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse(200, { success: true, message: 'Account successfully created!' })));
        const user = userEvent.setup();
        const { unmount } = render(<App />);
        await user.type(await screen.findByLabelText('Username'), 'riley.student');
        await user.type(screen.getByLabelText('Email'), 'Riley.Student@test.com');
        await user.type(screen.getByLabelText('Password'), 'Student123!');
        await user.type(screen.getByLabelText('Confirm Password'), 'Student123!');
        await user.click(screen.getByRole('button', { name: 'Sign Up' }));
        await screen.findByText('Account successfully saved! Redirecting to login...');
        unmount();

        window.history.replaceState({}, '', '/index.html');
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse(200, { success: true, role: 'user', communities: [] })));
        render(<App />);
        await user.type(await screen.findByLabelText('Email'), 'riley.student@test.com');
        await user.type(screen.getByLabelText('Password'), 'Student123!');
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        await waitFor(() => expect(localStorage.getItem('karavan_community_prompt')).toBe('1'));
        window.history.replaceState({}, '', '/');
    });
});
