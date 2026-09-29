import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminRegister from '../pages/AdminRegister.jsx';

function jsonResponse(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

async function fillValidForm(user, overrides = {}) {
    const values = {
        'Full Name': 'Chun Admin',
        'Business / Community Name': "Bob's Rentals",
        'Email Address': 'chun.admin@test.com',
        'Phone Number': '123-456-7890',
        Password: 'Admin123!',
        'Confirm Password': 'Admin123!',
        ...overrides,
    };
    for (const [label, value] of Object.entries(values)) {
        if (value) await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
}

const pdf = () => new File(['%PDF-1.4'], 'lease.pdf', { type: 'application/pdf' });
const uploadInput = () => screen.getByLabelText(/upload proof of ownership/i);

describe('AdminRegister page', () => {
    it('renders exactly one of each required control', () => {
        const { container } = render(<AdminRegister />);

        expect(screen.getAllByTestId('karavan-logo')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { name: 'Register as a Community Partner' })).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: /continue with university sso/i })).toHaveLength(1);
        for (const label of ['Full Name', 'Business / Community Name', 'Email Address', 'Phone Number', 'Password', 'Confirm Password']) {
            expect(screen.getAllByLabelText(label, { exact: true })).toHaveLength(1);
        }
        expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
        expect(uploadInput()).toHaveAttribute('name', 'proof_of_ownership');
        expect(screen.getAllByRole('button', { name: 'Submit for Approval' })).toHaveLength(1);
        expect(screen.getByText('Platform Admin & Property Management Portal')).toBeInTheDocument();
    });

    it('blocks submission and outlines the upload field in red when no file is attached', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error');
        expect(uploadInput()).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('Proof of ownership is required.');
    });

    it('rejects disallowed file types on the client without calling the server', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup({ applyAccept: false });
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.upload(uploadInput(), new File(['hi'], 'notes.txt', { type: 'text/plain' }));
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error');
        expect(screen.getByText('Invalid file type. Accepted formats: PDF, JPG, PNG.')).toBeInTheDocument();
    });

    it('rejects files over 2MB on the client', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<AdminRegister />);
        const huge = new File(['x'], 'deed.pdf', { type: 'application/pdf' });
        Object.defineProperty(huge, 'size', { value: 2 * 1024 * 1024 + 1 });

        await fillValidForm(user);
        await user.upload(uploadInput(), huge);
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByText('File is too large. Maximum size is 2MB.')).toBeInTheDocument();
    });

    it('rejects an empty file on the client', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.upload(uploadInput(), new File([], 'empty.pdf', { type: 'application/pdf' }));
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error');
        expect(screen.getByText('The file is empty. Please choose a different file.')).toBeInTheDocument();
    });

    it('blocks submission when passwords do not match', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user, { 'Confirm Password': 'Different1!' });
        await user.upload(uploadInput(), pdf());
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });

    it('accepts a dropped file', async () => {
        render(<AdminRegister />);
        const dropzone = screen.getByTestId('proof-dropzone');

        fireEvent.dragOver(dropzone, { dataTransfer: { files: [pdf()] } });
        expect(dropzone).toHaveClass('kv-dropzone--dragging');
        fireEvent.drop(dropzone, { dataTransfer: { files: [pdf()] } });

        expect(screen.getByText(/lease\.pdf/)).toBeInTheDocument();
        expect(dropzone).not.toHaveClass('kv-dropzone--error');
    });

    it('posts multipart form-data and shows the pending-review confirmation on success', async () => {
        const fetchMock = vi.fn(() => jsonResponse(201, { success: true, request_id: 7, status: 'pending' }));
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.upload(uploadInput(), pdf());
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        await screen.findByText('Your request is pending review');
        expect(screen.getByRole('status')).toHaveTextContent("Bob's Rentals");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toMatch(/admin_register\.php$/);
        expect(options.method).toBe('POST');
        const body = options.body;
        expect(body).toBeInstanceOf(FormData);
        expect(body.get('full_name')).toBe('Chun Admin');
        expect(body.get('business_name')).toBe("Bob's Rentals");
        expect(body.get('email')).toBe('chun.admin@test.com');
        expect(body.get('phone')).toBe('123-456-7890');
        expect(body.get('password')).toBe('Admin123!');
        expect(body.has('confirm_password')).toBe(false);
        expect(body.get('proof_of_ownership').name).toBe('lease.pdf');
    });

    it('shows a server-side file error on the upload field', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse(400, { success: false, error: 'Invalid file type. Accepted formats: PDF, JPG, PNG.' })));
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.upload(uploadInput(), pdf());
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        await waitFor(() => expect(screen.getByTestId('proof-dropzone')).toHaveClass('kv-dropzone--error'));
    });

    it('shows other server errors in a banner', async () => {
        vi.stubGlobal('fetch', vi.fn(() => jsonResponse(409, { success: false, error: 'An account with this email already exists.' })));
        const user = userEvent.setup();
        render(<AdminRegister />);

        await fillValidForm(user);
        await user.upload(uploadInput(), pdf());
        await user.click(screen.getByRole('button', { name: 'Submit for Approval' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
        expect(screen.queryByText('Your request is pending review')).not.toBeInTheDocument();
    });
});
