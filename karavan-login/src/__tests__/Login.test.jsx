import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

function jsonResponse(body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

async function fillCredentials(user, container, username, password) {
    await user.type(screen.getByRole('textbox'), username);
    await user.type(container.querySelector('input[type="password"]'), password);
}

describe('Login page registration', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('switches between Login and Register with the Register here / Login here toggle', async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(screen.getByRole('heading', { name: 'Karavan Login' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Register here' }));
        expect(screen.getByRole('heading', { name: 'Karavan Register' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Login here' }));
        expect(screen.getByRole('heading', { name: 'Karavan Login' })).toBeInTheDocument();
    });

    it('posts the new account to register.php and returns to Login on success', async () => {
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
        const fetchMock = vi.fn(() => jsonResponse({ success: true, message: 'Account successfully created!' }));
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        const { container } = render(<App />);

        await user.click(screen.getByRole('button', { name: 'Register here' }));
        await fillCredentials(user, container, 'new.student@test.com', 'Student123!');
        await user.click(screen.getByRole('button', { name: 'Register' }));

        expect(await screen.findByText('Account successfully created! Please log in.')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('./register.php');
        expect(JSON.parse(options.body)).toEqual({ username: 'new.student@test.com', password: 'Student123!' });
        expect(screen.getByRole('heading', { name: 'Karavan Login' })).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue('new.student@test.com');
    });

    it('shows the server error when the username is taken', async () => {
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: false, error: 'Username already exists.' })));
        const user = userEvent.setup();
        const { container } = render(<App />);

        await user.click(screen.getByRole('button', { name: 'Register here' }));
        await fillCredentials(user, container, 'taken@test.com', 'Student123!');
        await user.click(screen.getByRole('button', { name: 'Register' }));

        expect(await screen.findByText('Username already exists.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Karavan Register' })).toBeInTheDocument();
    });
});
