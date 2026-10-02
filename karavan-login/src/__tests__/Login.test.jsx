import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

function jsonResponse(body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

const openPage = (path) => window.history.replaceState({}, '', path);

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
        const [url, options] = fetchMock.mock.calls[0];
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
        const [url, options] = fetchMock.mock.calls[0];
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
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the server error when the username or email is taken', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: false, error: 'Username or Email already exists.' })));
        const user = userEvent.setup();
        render(<App />);

        await fillSignUp(user);

        expect(await screen.findByText('Username or Email already exists.')).toBeInTheDocument();
    });
});
