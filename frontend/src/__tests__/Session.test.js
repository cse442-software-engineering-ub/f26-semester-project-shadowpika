import { describe, expect, it, vi } from 'vitest';
import { hasAuthCookie, signOut } from '../session.js';

describe('shared session wiring', () => {
    it('uses the POST logout contract and navigates only after success', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const navigate = vi.fn();
        await signOut(navigate);
        expect(fetchMock).toHaveBeenCalledWith('/logout.php', { method: 'POST', credentials: 'same-origin' });
        expect(navigate).toHaveBeenCalledWith('/index.html');
    });

    it('does not claim logout succeeded when the API rejects it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 500 })));
        const navigate = vi.fn();
        await expect(signOut(navigate)).rejects.toThrow('Logout failed.');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('does not treat an unrelated or empty cookie as authentication', () => {
        expect(hasAuthCookie('other=1; karavan_auth_cookie=student')).toBe(true);
        expect(hasAuthCookie('karavan_auth_cookie=')).toBe(false);
        expect(hasAuthCookie('not_karavan_auth_cookie=student')).toBe(false);
    });
});
