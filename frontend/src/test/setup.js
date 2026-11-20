import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement native modal dialogs. Browser checks cover real inert/focus behavior.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true,
    value() { this.setAttribute('open', ''); } });
Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true,
    value() { this.removeAttribute('open'); } });

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});
