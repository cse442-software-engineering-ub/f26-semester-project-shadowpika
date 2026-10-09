import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

function jsonResponse(body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

const openPage = (path) => window.history.replaceState({}, '', path);

// The page first asks session.php whether someone is already signed in.
const formCalls = (fetchMock) => fetchMock.mock.calls.filter(([url]) => !url.endsWith('session.php'));

describe('Login page', () => {
    beforeEach(() => {
        openPage('/index.html');
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        openPage('/');
    });

    it('asks for an email and password and links to Sign up and the Community Partner page', async () => {
        render(<App />);

        expect(await screen.findByLabelText('Email')).toHaveAttribute('type', 'email');
        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', './register.html');
        expect(screen.getByRole('link', { name: 'Register as a Community Partner' })).toHaveAttribute('href', '/#/admin-register');
    });

    it('posts the email and password to login.php', async () => {
        const fetchMock = vi.fn(() => jsonResponse({ success: false, error: 'Invalid username or password.' }));
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<App />);

        await user.type(await screen.findByLabelText('Email'), 'alex.landlord@test.com');
        await user.type(screen.getByLabelText('Password'), 'Landlord123!');
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument();
        const [[url, options]] = formCalls(fetchMock);
        expect(url).toBe('./login.php');
        expect(JSON.parse(options.body)).toEqual({ email: 'alex.landlord@test.com', password: 'Landlord123!' });
    });

    it('sends a moderator to the moderator page instead of home', async () => {
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, hostname: 'localhost', pathname: '/index.html', hash: '', assign });
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: true, role: 'moderator' })));
        const user = userEvent.setup();
        render(<App />);

        await user.type(await screen.findByLabelText('Email'), 'mod@test.com');
        await user.type(screen.getByLabelText('Password'), 'Moderator123!');
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/#/moderator'));
    });
});

describe('Persistent login', () => {
    const LOGGED_OUT = { success: false, logged_in: false, error: 'You are not logged in.' };
    const sessionFor = (role) => ({ success: true, logged_in: true, user_id: 7, username: 'jamie.student', email: 'jamie.student@test.com', role });

    function stubPage(pathname) {
        const replace = vi.fn();
        vi.stubGlobal('location', { ...window.location, hostname: 'aptitude.cse.buffalo.edu', pathname, hash: '', replace });
        return replace;
    }

    function stubSession(status, body) {
        const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })));
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    }

    beforeEach(() => {
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
    });

    // Persistent login frontend, Test 1
    it('sends a signed-in user from the login page straight to the home page', async () => {
        const replace = stubPage('/CSE442/2026-Fall/cse-442j/index.html');
        const fetchMock = stubSession(200, sessionFor('user'));
        render(<App />);

        await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('./home.html'));
        expect(fetchMock.mock.calls[0][0]).toBe('/CSE442/2026-Fall/cse-442j/session.php');
        expect(screen.queryByRole('button', { name: 'Log In' })).not.toBeInTheDocument();
    });

    // Persistent login frontend, Test 2
    it('sends a signed-in moderator to the moderator page instead', async () => {
        const replace = stubPage('/CSE442/2026-Fall/cse-442j/');
        stubSession(200, sessionFor('moderator'));
        render(<App />);

        await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/CSE442/2026-Fall/cse-442j/#/moderator'));
    });

    // Persistent login frontend, Test 3
    it('shows the login form when nobody is signed in', async () => {
        const replace = stubPage('/CSE442/2026-Fall/cse-442j/index.html');
        stubSession(401, LOGGED_OUT);
        render(<App />);

        expect(await screen.findByRole('button', { name: 'Log In' })).toBeInTheDocument();
        expect(replace).not.toHaveBeenCalled();
    });

    it('shows the login form when the login cannot be checked', async () => {
        stubPage('/CSE442/2026-Fall/cse-442j/index.html');
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
        render(<App />);

        expect(await screen.findByRole('button', { name: 'Log In' })).toBeInTheDocument();
    });

    it('sends a signed-in user away from the sign up page too', async () => {
        const replace = stubPage('/CSE442/2026-Fall/cse-442j/register.html');
        stubSession(200, sessionFor('admin'));
        render(<App />);

        await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('./home.html'));
    });
});

describe('Sign up page', () => {
    beforeEach(() => {
        openPage('/register.html');
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        openPage('/');
    });

    async function fillSignUp(user, { username = 'testuser1', email = 'testuser1@test.com', password = 'TestUser123!', confirm = password } = {}) {
        await user.type(await screen.findByLabelText('Username'), username);
        await user.type(screen.getByLabelText('Email'), email);
        await user.type(screen.getByLabelText('Password'), password);
        await user.type(screen.getByLabelText('Confirm Password'), confirm);
        await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    }

    it('creates the account through register.php', async () => {
        const fetchMock = vi.fn(() => jsonResponse({ success: true, message: 'Account successfully created!' }));
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<App />);

        await fillSignUp(user);

        expect(await screen.findByText('Account successfully saved! Redirecting to login...')).toBeInTheDocument();
        const [[url, options]] = formCalls(fetchMock);
        expect(url).toBe('./register.php');
        expect(JSON.parse(options.body)).toEqual({ username: 'testuser1', email: 'testuser1@test.com', password: 'TestUser123!' });
        expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', './index.html');
    });

    it('blocks mismatched passwords without contacting the server', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<App />);

        await fillSignUp(user, { confirm: 'Different123!' });

        expect(await screen.findByText('Error: Passwords do not match.')).toBeInTheDocument();
        expect(formCalls(fetchMock)).toHaveLength(0);
    });

    it('shows the server error when the username or email is taken', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: false, error: 'Username or Email already exists.' })));
        const user = userEvent.setup();
        render(<App />);

        await fillSignUp(user);

        expect(await screen.findByText('Username or Email already exists.')).toBeInTheDocument();
    });
});
