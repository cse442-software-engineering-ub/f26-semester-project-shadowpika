import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); window.history.replaceState({}, '', '/'); });

it('requires the security fields and includes them in registration JSON', async () => {
    window.history.replaceState({}, '', '/register.html'); vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
    const mock = vi.fn(async () => ({ json: async () => ({ success: false, error: 'Test response' }) })); vi.stubGlobal('fetch', mock);
    const user = userEvent.setup(); render(<App />);
    await user.type(await screen.findByLabelText('Username'), 'reset106');
    await user.type(screen.getByLabelText('Email'), 'reset106@example.com');
    await user.type(screen.getByLabelText('Password'), 'Before123!');
    await user.type(screen.getByLabelText('Confirm Password'), 'Before123!');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    expect(mock.mock.calls.filter(([url]) => String(url).includes('register.php'))).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText('Security question'), '0');
    await user.type(screen.getByLabelText('Security answer'), 'MiLo');
    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await screen.findByText('Test response');
    const call = mock.mock.calls.find(([url]) => String(url).includes('register.php'));
    expect(JSON.parse(call[1].body)).toEqual({ username: 'reset106', email: 'reset106@example.com', password: 'Before123!', security_question: 0, security_answer: 'MiLo' });
});

it('routes both login and account settings to the same reset page', async () => {
    vi.stubEnv('VITE_LOCAL_BACKEND', 'true'); vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ logged_in: false }) })));
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Forgot Password' })).toHaveAttribute('href', './reset-password.html');
    const html = readFileSync(resolve(__dirname, '../../settings/account-settings.html'), 'utf8');
    const page = new DOMParser().parseFromString(html, 'text/html');
    const link = [...page.querySelectorAll('a')].find(a => a.textContent.includes('Reset Password'));
    expect(link.getAttribute('href')).toBe('../reset-password.html');
});
