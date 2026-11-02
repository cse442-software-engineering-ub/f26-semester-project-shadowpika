import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

const settingsDir = resolve(__dirname, '../../settings');
const html = readFileSync(resolve(settingsDir, 'account-settings.html'), 'utf8');
const css = readFileSync(resolve(settingsDir, 'account-settings.css'), 'utf8');

function loadPage(sessionBody) {
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
    document.cookie = 'karavan_auth_cookie=riley.shopper204; path=/';
    globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve(sessionBody) }));
    const inline = [...document.body.querySelectorAll('script:not([src])')].map((s) => s.textContent).join('\n');
    window.eval(inline);
}

function cssRule(selector) {
    const escaped = selector.replace('.', '\\.');
    return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))[1];
}

afterEach(() => {
    document.cookie = 'karavan_auth_cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('Account settings page', () => {
    it('fills the email from the session even though the cookie only holds the username', async () => {
        loadPage({ success: true, logged_in: true, username: 'riley.shopper204', email: 'riley@example.com' });

        await waitFor(() => expect(document.getElementById('email').value).toBe('riley@example.com'));
        expect(document.getElementById('name').value).toBe('riley.shopper204');
        expect(globalThis.fetch).toHaveBeenCalledWith('../session.php', expect.objectContaining({ credentials: 'same-origin' }));
    });

    it('leaves the fields empty when nobody is signed in', async () => {
        loadPage({ success: false, logged_in: false });

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        expect(document.getElementById('email').value).toBe('');
        expect(document.getElementById('name').value).toBe('');
    });

    it.each(['.change-password', '.delete-button', '.save-button'])('%s uses white text', (selector) => {
        expect(cssRule(selector)).toMatch(/(^|[\s;])color:\s*#ffffff/i);
    });
});
