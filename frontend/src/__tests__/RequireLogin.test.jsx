import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import RequireLogin from '../components/RequireLogin.jsx';

const LOGGED_IN = { success: true, logged_in: true, user_id: 7, username: 'jamie.student', email: 'jamie.student@test.com', role: 'user' };
const LOGGED_OUT = { success: false, logged_in: false, error: 'You are not logged in.' };

function jsonResponse(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function stubSession(...responses) {
    const fetchMock = vi.fn();
    for (const [status, body] of responses) fetchMock.mockImplementationOnce(() => jsonResponse(status, body));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function stubPage(pathname = '/CSE442/2026-Fall/cse-442j/home.html') {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, hostname: 'aptitude.cse.buffalo.edu', pathname, hash: '', replace });
    return replace;
}

const renderPage = () =>
    render(
        <RequireLogin>
            <h1>Secret home page</h1>
        </RequireLogin>,
    );

describe('Pages that need a login', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
    });

    // Login blocking frontend, Test 1
    it('shows the page to a signed-in user', async () => {
        const replace = stubPage();
        const fetchMock = stubSession([200, LOGGED_IN]);
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Secret home page' })).toBeInTheDocument();
        expect(fetchMock.mock.calls[0][0]).toBe('/CSE442/2026-Fall/cse-442j/session.php');
        expect(replace).not.toHaveBeenCalled();
    });

    // Login blocking frontend, Test 2
    it('sends a logged-out visitor to the login page without ever showing the page', async () => {
        const replace = stubPage();
        stubSession([401, LOGGED_OUT]);
        renderPage();

        expect(screen.queryByRole('heading', { name: 'Secret home page' })).not.toBeInTheDocument();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/CSE442/2026-Fall/cse-442j/'));
        expect(screen.queryByRole('heading', { name: 'Secret home page' })).not.toBeInTheDocument();
    });

    it('sends the visitor to the login page when the login cannot be checked', async () => {
        const replace = stubPage();
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
        renderPage();

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/CSE442/2026-Fall/cse-442j/'));
        expect(screen.queryByRole('heading', { name: 'Secret home page' })).not.toBeInTheDocument();
    });

    it('does not trust a 200 response that does not say the user is logged in', async () => {
        const replace = stubPage();
        stubSession([200, { success: true }]);
        renderPage();

        await waitFor(() => expect(replace).toHaveBeenCalled());
        expect(screen.queryByRole('heading', { name: 'Secret home page' })).not.toBeInTheDocument();
    });

    // Login blocking frontend, Test 3
    it('checks again when Back shows a cached copy of the page after logging out', async () => {
        const replace = stubPage();
        const fetchMock = stubSession([200, LOGGED_IN], [401, LOGGED_OUT]);
        renderPage();
        await screen.findByRole('heading', { name: 'Secret home page' });

        act(() => {
            window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
        });

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/CSE442/2026-Fall/cse-442j/'));
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('lets `npm run dev` without PHP show pages without a login check', () => {
        vi.stubEnv('VITE_LOCAL_BACKEND', '');
        vi.stubGlobal('location', { ...window.location, hostname: 'localhost' });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        renderPage();

        expect(screen.getByRole('heading', { name: 'Secret home page' })).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

// Every page except login, sign up, the Community Partner form and 404 needs a login.
const entries = import.meta.glob('../*-main.jsx', { query: '?raw', import: 'default', eager: true });
const PUBLIC_ENTRIES = ['not-found-main.jsx', 'navbar-main.jsx'];

describe('Page entry points', () => {
    const protectedEntries = Object.entries(entries).filter(([path]) => !PUBLIC_ENTRIES.some((name) => path.endsWith(name)));

    it('covers every page that needs a login', () => {
        expect(protectedEntries.map(([path]) => path.split('/').pop()).sort()).toEqual([
            'home-main.jsx', 'item-main.jsx', 'listings-main.jsx', 'meet-main.jsx', 'product-search-main.jsx', 'sell-main.jsx', 'settings-main.jsx',
        ]);
    });

    it.each(protectedEntries)('%s wraps its page in RequireLogin', (_, source) => {
        expect(source).toMatch(/<RequireLogin>[\s\S]+<\/RequireLogin>/);
    });
});
