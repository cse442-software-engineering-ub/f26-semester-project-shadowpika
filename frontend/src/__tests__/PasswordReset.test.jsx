import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordReset from '../PasswordReset.jsx';

afterEach(() => vi.unstubAllGlobals());

function api(responses) {
    const mock = vi.fn(async () => {
        const body = responses.shift();
        if (body instanceof Error) throw body;
        return { ok: body.success, status: body.success ? 200 : 403, json: async () => body };
    });
    vi.stubGlobal('fetch', mock);
    return mock;
}
const question = { success: true, question_id: 0, question: 'What was the name of your first pet?' };
async function lookup(user) {
    await user.type(screen.getByLabelText('Email'), 'reset@example.com');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText('Security answer');
}
async function verify(user) {
    await user.type(screen.getByLabelText('Security answer'), 'MiLo');
    await user.click(screen.getByRole('button', { name: 'Verify answer' }));
    await screen.findByLabelText('New password');
}

describe('Password reset frontend #106', () => {
    it('requires verification before showing new passwords and sends the agreed requests', async () => {
        const mock = api([question, { success: true }, { success: true }]);
        const user = userEvent.setup(); render(<PasswordReset />);
        expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
        await lookup(user);
        expect(screen.getByText(question.question)).toBeInTheDocument();
        await verify(user);
        await user.type(screen.getByLabelText('New password'), 'Fresh123!');
        await user.type(screen.getByLabelText('Confirm password'), 'Fresh123!');
        await user.click(screen.getByRole('button', { name: 'Reset Password' }));
        expect(await screen.findByRole('status')).toHaveTextContent('Your password has been reset');
        expect(screen.getByRole('link', { name: 'Back to Log In' })).toHaveAttribute('href', './index.html');
        expect(mock.mock.calls.map(([url, options]) => [url, JSON.parse(options.body)])).toEqual([
            ['./forgot_password.php', { email: 'reset@example.com' }],
            ['./verify_security_answer.php', { answer: 'MiLo' }],
            ['./reset_password.php', { password: 'Fresh123!' }],
        ]);
    });
    it('keeps the answer step on rejection and permits retry', async () => {
        api([question, { success: false, error: 'Incorrect security answer.' }, { success: true }]);
        const user = userEvent.setup(); render(<PasswordReset />); await lookup(user);
        await user.type(screen.getByLabelText('Security answer'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'Verify answer' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect security answer.');
        expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
        await user.clear(screen.getByLabelText('Security answer')); await verify(user);
    });
    it('rejects mismatched passwords without sending the reset', async () => {
        const mock = api([question, { success: true }]);
        const user = userEvent.setup(); render(<PasswordReset />); await lookup(user); await verify(user);
        await user.type(screen.getByLabelText('New password'), 'First123!');
        await user.type(screen.getByLabelText('Confirm password'), 'Other123!');
        await user.click(screen.getByRole('button', { name: 'Reset Password' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
        expect(mock).toHaveBeenCalledTimes(2);
    });
    it('shows network failures and restarts expired grants', async () => {
        api([new Error('offline'), question, { success: false, code: 'restart_required', error: 'Start again.' }]);
        const user = userEvent.setup(); render(<PasswordReset />);
        await user.type(screen.getByLabelText('Email'), 'reset@example.com');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not connect');
        await user.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByLabelText('Security answer'); await user.type(screen.getByLabelText('Security answer'), 'milo');
        await user.click(screen.getByRole('button', { name: 'Verify answer' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Start again.');
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
    it('disables submission while pending and allows starting over without saving', async () => {
        let finish; const mock = vi.fn(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal('fetch', mock);
        const user = userEvent.setup(); render(<PasswordReset />);
        await user.type(screen.getByLabelText('Email'), 'reset@example.com');
        await user.dblClick(screen.getByRole('button', { name: 'Continue' }));
        expect(mock).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
        finish({ ok: true, json: async () => question });
        await waitFor(() => expect(screen.getByLabelText('Security answer')).toBeInTheDocument());
        await user.click(screen.getByRole('button', { name: 'Start over' }));
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.queryByLabelText('Security answer')).not.toBeInTheDocument();
    });
});
