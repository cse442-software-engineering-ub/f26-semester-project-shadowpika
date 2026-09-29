import { describe, expect, it } from 'vitest';
import { appBase, currentRoute, pathFor } from '../routes.js';

const loc = (pathname, hash = '') => ({ pathname, hash });

describe('routes', () => {
    it.each([
        ['/admin-register', 'admin-register'],
        ['/CSE442/2026-Fall/cse-442j/admin-register/', 'admin-register'],
        ['/CSE442/2026-Fall/cse-442j/', 'login'],
        ['/CSE442/2026-Fall/cse-442j/index.html', 'login'],
    ])('%s resolves to %s', (pathname, route) => {
        expect(currentRoute(loc(pathname))).toBe(route);
    });

    it('supports hash routes for servers without rewrites', () => {
        expect(currentRoute(loc('/CSE442/2026-Fall/cse-442j/index.html', '#/admin-register'))).toBe('admin-register');
    });

    it('links to pages with hash routes so no server rewrite is needed', () => {
        expect(pathFor('admin-register')).toBe('/#/admin-register');
        expect(pathFor('login')).toBe('/');
    });

    it.each([
        ['/admin-register', '/'],
        ['/CSE442/2026-Fall/cse-442j/admin-register', '/CSE442/2026-Fall/cse-442j/'],
        ['/CSE442/2026-Fall/cse-442j/index.html', '/CSE442/2026-Fall/cse-442j/'],
    ])('base of %s is %s', (pathname, base) => {
        expect(appBase(loc(pathname))).toBe(base);
    });
});
