// Mirrors the frontend task cards for #101 (admin registration) and the moderator
// approval page, using the same network-override payloads the cards specify.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';
import AdminRegister from '../pages/AdminRegister.jsx';
import ModeratorDashboard from '../pages/ModeratorDashboard.jsx';

const ALEX = {
    request_id: 5001,
    full_name: 'Alex Landlord',
    business_name: 'Landlord Properties LLC',
    proof_of_ownership_url: 'uploads/lease.pdf',
};

function json(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/** Stand-in for Chrome DevTools network overrides: maps endpoint -> [status, body]. */
function override(routes) {
    const fetchMock = vi.fn((url) => {
        const match = Object.keys(routes).find((endpoint) => url.endsWith(endpoint));
        if (!match) return json(403, { success: false, error: 'You do not have permission to perform this action.' });
        const [status, body] = routes[match];
        return json(status, body);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const callsTo = (fetchMock, endpoint) => fetchMock.mock.calls.filter(([url]) => url.endsWith(endpoint));

async function fillAllFields(user) {
    await user.type(screen.getByLabelText('Full Name', { exact: true }), 'Alex Landlord');
    await user.type(screen.getByLabelText('Business / Community Name', { exact: true }), 'Landlord Properties LLC');
    await user.type(screen.getByLabelText('Email Address', { exact: true }), 'alex.landlord@test.com');
    await user.type(screen.getByLabelText('Phone Number', { exact: true }), '123-456-7890');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'Landlord123!');
    await user.type(screen.getByLabelText('Confirm Password', { exact: true }), 'Landlord123!');
}

const uploadInput = () => screen.getByLabelText(/upload proof of ownership/i);
const submit = () => screen.getByRole('button', { name: 'Submit for Approval' });

describe('Frontend: Admin Registration Page (#101)', () => {
    it('Test 1: submits a complete registration and shows the pending-review confirmation', async () => {
        const fetchMock = override({ 'admin_register.php': [201, { success: true, request_id: 5001, status: 'pending' }] });
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillAllFields(user);
        await user.upload(uploadInput(), new File(['%PDF-1.4'], 'lease.pdf', { type: 'application/pdf' }));
        await user.click(submit());

        expect(await screen.findByText('Your request is pending review')).toBeInTheDocument();
        const [[, options]] = callsTo(fetchMock, 'admin_register.php');
        expect(options.method).toBe('POST');
    });

    it('Test 2: sends no request and outlines the upload control in red when the file is missing', async () => {
        const fetchMock = override({});
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillAllFields(user);
        await user.click(submit());

        expect(callsTo(fetchMock, 'admin_register.php')).toHaveLength(0);
        expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error');
    });

    it('Test 3: shows the invalid-type message and no confirmation for a .exe', async () => {
        override({ 'admin_register.php': [400, { success: false, error: 'Invalid file type. Accepted formats: PDF, JPG, PNG.' }] });
        const user = userEvent.setup({ applyAccept: false });
        render(<AdminRegister />);

        await fillAllFields(user);
        await user.upload(uploadInput(), new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }));
        await user.click(submit());

        expect(await screen.findByText('Invalid file type. Accepted formats: PDF, JPG, PNG.')).toBeInTheDocument();
        expect(screen.queryByText('Your request is pending review')).not.toBeInTheDocument();
    });

    it('Test 3 (server path): shows the backend rejection message when the server refuses the file', async () => {
        override({ 'admin_register.php': [400, { success: false, error: 'Invalid file type. Accepted formats: PDF, JPG, PNG.' }] });
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillAllFields(user);
        await user.upload(uploadInput(), new File(['not really a pdf'], 'lease.pdf', { type: 'application/pdf' }));
        await user.click(submit());

        expect(await screen.findByText('Invalid file type. Accepted formats: PDF, JPG, PNG.')).toBeInTheDocument();
        expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error');
        expect(screen.queryByText('Your request is pending review')).not.toBeInTheDocument();
    });
});

describe('Frontend: Moderator Approval Page', () => {
    const pendingOverride = { 'moderator_requests.php': [200, { success: true, requests: [ALEX] }] };

    it('Test 1: a moderator logging in on the normal login page is sent to the moderator page', async () => {
        vi.stubEnv('VITE_LOCAL_BACKEND', 'true');
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, hostname: 'localhost', pathname: '/', hash: '', assign });
        override({ 'login.php': [200, { success: true, authenticated: true, role: 'moderator' }] });
        const user = userEvent.setup();
        render(<App />);

        await user.type(await screen.findByLabelText('Email'), 'moderator@test.com');
        await user.type(screen.getByLabelText('Password'), 'Moderator123!');
        await user.click(screen.getByRole('button', { name: 'Log In' }));

        await waitFor(() => expect(assign).toHaveBeenCalledWith('/#/moderator'));
    });

    it('Test 1: the moderator page lists Alex Landlord and Landlord Properties LLC', async () => {
        override(pendingOverride);
        render(<ModeratorDashboard />);

        const item = await screen.findByRole('listitem', { name: 'Request from Alex Landlord' });
        expect(within(item).getByText('Alex Landlord')).toBeInTheDocument();
        expect(within(item).getByText('Landlord Properties LLC')).toBeInTheDocument();
    });

    it('Test 2: the pending request renders a link to the proof-of-ownership document', async () => {
        override(pendingOverride);
        render(<ModeratorDashboard />);

        const item = await screen.findByRole('listitem', { name: 'Request from Alex Landlord' });
        const link = within(item).getByRole('link', { name: 'View proof of ownership' });

        expect(link.getAttribute('href')).toMatch(/\/uploads\/lease\.pdf$/);
    });

    it('Test 2: absolute proof URLs are used as-is', async () => {
        override({ 'moderator_requests.php': [200, { success: true, requests: [{ ...ALEX, proof_of_ownership_url: 'https://example.com/docs/lease.pdf' }] }] });
        render(<ModeratorDashboard />);

        const item = await screen.findByRole('listitem', { name: 'Request from Alex Landlord' });

        expect(within(item).getByRole('link', { name: 'View proof of ownership' })).toHaveAttribute('href', 'https://example.com/docs/lease.pdf');
    });

    it('Test 5: shows an empty state when nothing is pending', async () => {
        override({ 'moderator_requests.php': [200, { success: true, requests: [] }] });
        render(<ModeratorDashboard />);

        expect(await screen.findByText(/no pending requests/i)).toBeInTheDocument();
    });

    it.each([
        ['Test 3', 'Approve', 'approve', 'approved', "Approved Alex Landlord's request for Landlord Properties LLC."],
        ['Test 4', 'Deny', 'deny', 'denied', "Denied Alex Landlord's request for Landlord Properties LLC."],
    ])('%s: clicking %s sends the exact body, confirms, and removes the request', async (_card, button, action, status, message) => {
        const fetchMock = override({
            ...pendingOverride,
            'moderator_approve.php': [200, { success: true, request_id: 5001, status }],
        });
        const user = userEvent.setup();
        render(<ModeratorDashboard />);

        const item = await screen.findByRole('listitem', { name: 'Request from Alex Landlord' });
        await user.click(within(item).getByRole('button', { name: button }));

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(screen.queryByRole('listitem', { name: 'Request from Alex Landlord' })).not.toBeInTheDocument();

        const [[, options]] = callsTo(fetchMock, 'moderator_approve.php');
        expect(options.method).toBe('POST');
        expect(options.body).toBe(`{"request_id":5001,"action":"${action}"}`);
    });
});
