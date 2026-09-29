import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModeratorDashboard from '../pages/ModeratorDashboard.jsx';

const PENDING = [
    {
        request_id: 1,
        full_name: 'Chun Admin',
        business_name: 'Test business',
        email: 'chun@test.com',
        phone: '123-456-7890',
        created_at: '2026-09-28 10:00:00',
        proof_of_ownership_url: 'proof_file.php?request_id=1',
    },
    { request_id: 2, full_name: 'Ada Lovelace', business_name: "Ada's Lofts", proof_of_ownership_url: 'proof_file.php?request_id=2' },
];

function jsonResponse(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

/** Routes fetch calls by endpoint; `decisions` maps request_id -> [status, body] for moderator_approve.php. */
function mockBackend({ pending = PENDING, listStatus = 200, decisions = {} } = {}) {
    const fetchMock = vi.fn((url, options = {}) => {
        if (url.endsWith('moderator_requests.php')) {
            if (listStatus !== 200) {
                return jsonResponse(listStatus, { success: false, error: 'You do not have permission to perform this action.' });
            }
            return jsonResponse(200, { success: true, requests: pending });
        }
        if (url.endsWith('moderator_approve.php')) {
            const { request_id: id, action } = JSON.parse(options.body);
            const [status, body] = decisions[id] ?? [200, { success: true, request_id: id, status: action === 'approve' ? 'approved' : 'denied' }];
            return jsonResponse(status, body);
        }
        throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const item = (name) => screen.findByRole('listitem', { name: `Request from ${name}` });

describe('Moderator dashboard', () => {
    it('lists every pending request on the page with its details and document link', async () => {
        mockBackend();
        render(<ModeratorDashboard />);

        const first = await item('Chun Admin');
        const second = await item('Ada Lovelace');

        expect(screen.getByText('2 pending requests awaiting review.')).toBeInTheDocument();
        expect(within(first).getByText('Test business')).toBeInTheDocument();
        expect(within(first).getByText('chun@test.com')).toBeInTheDocument();
        expect(within(first).getByText('123-456-7890')).toBeInTheDocument();
        expect(within(second).getByText("Ada's Lofts")).toBeInTheDocument();
        const proofLink = within(first).getByRole('link', { name: 'View proof of ownership' });
        expect(proofLink.getAttribute('href')).toMatch(/proof_file\.php\?request_id=1$/);
        expect(proofLink).toHaveAttribute('target', '_blank');
        expect(within(first).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
        expect(within(first).getByRole('button', { name: 'Deny' })).toBeInTheDocument();
    });

    it('shows an empty state when nothing is pending', async () => {
        mockBackend({ pending: [] });
        render(<ModeratorDashboard />);

        expect(await screen.findByText(/no pending requests/i)).toBeInTheDocument();
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('approves a request, removes it from the list and confirms', async () => {
        const fetchMock = mockBackend();
        const user = userEvent.setup();
        render(<ModeratorDashboard />);

        await user.click(within(await item('Chun Admin')).getByRole('button', { name: 'Approve' }));

        await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Request from Chun Admin' })).not.toBeInTheDocument());
        expect(screen.getByRole('status')).toHaveTextContent("Approved Chun Admin's request for Test business.");
        expect(screen.getByRole('listitem', { name: 'Request from Ada Lovelace' })).toBeInTheDocument();
        expect(screen.getByText('1 pending request awaiting review.')).toBeInTheDocument();

        const approveCall = fetchMock.mock.calls.find(([url]) => url.endsWith('moderator_approve.php'));
        expect(approveCall[1].method).toBe('POST');
        expect(JSON.parse(approveCall[1].body)).toEqual({ request_id: 1, action: 'approve' });
    });

    it('denies the last request and shows the empty state', async () => {
        const fetchMock = mockBackend({ pending: [PENDING[1]] });
        const user = userEvent.setup();
        render(<ModeratorDashboard />);

        await user.click(within(await item('Ada Lovelace')).getByRole('button', { name: 'Deny' }));

        expect(await screen.findByText("Denied Ada Lovelace's request for Ada's Lofts.")).toBeInTheDocument();
        expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
        const denyCall = fetchMock.mock.calls.find(([url]) => url.endsWith('moderator_approve.php'));
        expect(JSON.parse(denyCall[1].body)).toEqual({ request_id: 2, action: 'deny' });
    });

    it('keeps the request and shows an error when the decision fails', async () => {
        mockBackend({ decisions: { 1: [409, { success: false, error: 'This request has already been reviewed.' }] } });
        const user = userEvent.setup();
        render(<ModeratorDashboard />);
        const first = await item('Chun Admin');

        await user.click(within(first).getByRole('button', { name: 'Approve' }));

        expect(await within(first).findByRole('alert')).toHaveTextContent('This request has already been reviewed.');
        expect(screen.getByRole('listitem', { name: 'Request from Chun Admin' })).toBeInTheDocument();
    });

    it('shows a permission message instead of the list for non-moderators', async () => {
        mockBackend({ listStatus: 403 });
        render(<ModeratorDashboard />);

        expect(await screen.findByRole('heading', { name: 'Moderator access required' })).toBeInTheDocument();
        expect(screen.getByText(/you do not have permission to perform this action/i)).toBeInTheDocument();
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });
});
