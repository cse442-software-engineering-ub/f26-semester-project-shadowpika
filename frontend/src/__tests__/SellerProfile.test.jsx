/**
 * @vitest-environment jsdom
 */
// Frontend task card #134 (Review frontend) and user story #132 (rate a seller after a purchase).
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SellerProfile from '../SellerProfile.jsx';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

const PAGE = {
    success: true, seller_id: 217, seller_name: 'morgan.keller1', averageRating: 4.5, ratingCount: 2,
    ratings: [
        { reviewer_name: 'riley.shopper', rating: 5, review: 'Smooth pickup.', created_at: '2026-11-03T15:00:00Z' },
        { reviewer_name: 'quinn.buyer', rating: 4, review: '', created_at: '2026-11-02T15:00:00Z' },
    ],
    is_seller: false, can_rate: true, my_rating: null,
};

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
}));

function mockBackend(pages, post) {
    const queue = [...pages];
    const fetchMock = vi.fn((url, options = {}) => {
        if (options.method === 'POST') return post(JSON.parse(options.body));
        return json(queue.length > 1 ? queue.shift() : queue[0]);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const posts = (fetchMock) => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');

describe('Seller page (#134)', () => {
    beforeEach(() => window.history.replaceState({}, '', '/seller.html?seller_id=217'));
    afterEach(() => vi.unstubAllGlobals());

    it('shows who the seller is, their average, count, and every review', async () => {
        const fetchMock = mockBackend([PAGE]);
        render(<SellerProfile />);

        expect(await screen.findByRole('heading', { name: 'morgan.keller1' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('./api/ratings.php?seller_id=217', expect.anything());
        expect(screen.getByText('4.5 (2 ratings)')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: '4.5 out of 5 stars' })).toBeInTheDocument();
        expect(screen.getByText('Smooth pickup.')).toBeInTheDocument();
        expect(screen.getByText('quinn.buyer')).toBeInTheDocument();
        expect(screen.getByText('No written review.')).toBeInTheDocument();
    });

    it('submits a star rating and review, then shows the updated summary', async () => {
        const updated = { ...PAGE, averageRating: 4.7, ratingCount: 3, my_rating: { rating: 5, review: 'Great seller' } };
        const fetchMock = mockBackend([PAGE, updated],
            () => json({ success: true, message: 'Rating saved successfully.', averageRating: 4.7, ratingCount: 3 }));
        render(<SellerProfile />);

        fireEvent.click(await screen.findByRole('radio', { name: '5 stars' }));
        expect(screen.getByText('Excellent')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Review (optional)'), { target: { value: '  Great seller  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Submit Rating' }));

        expect(await screen.findByRole('status')).toHaveTextContent('Rating saved successfully.');
        expect(JSON.parse(posts(fetchMock)[0][1].body)).toEqual({ seller_id: 217, rating: 5, review: 'Great seller' });
        expect(await screen.findByText('4.7 (3 ratings)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Update Rating' })).toBeInTheDocument();
    });

    it('requires a star before submitting', async () => {
        const fetchMock = mockBackend([PAGE], () => json({ success: true }));
        render(<SellerProfile />);

        fireEvent.click(await screen.findByRole('button', { name: 'Submit Rating' }));
        expect(screen.getByRole('alert')).toHaveTextContent('Choose from 1 to 5 stars.');
        expect(posts(fetchMock)).toHaveLength(0);
    });

    it('limits reviews to 1000 characters with a counter', async () => {
        mockBackend([PAGE]);
        render(<SellerProfile />);
        const review = await screen.findByLabelText('Review (optional)');
        expect(review).toHaveAttribute('maxLength', '1000');
        fireEvent.change(review, { target: { value: 'abc' } });
        expect(screen.getByText('3/1000')).toBeInTheDocument();
    });

    it('prefills the buyer\'s earlier rating so they can update it', async () => {
        mockBackend([{ ...PAGE, my_rating: { rating: 3, review: 'Was late.' } }]);
        render(<SellerProfile />);
        expect(await screen.findByRole('radio', { name: '3 stars' })).toBeChecked();
        expect(screen.getByLabelText('Review (optional)')).toHaveValue('Was late.');
        expect(screen.getByRole('button', { name: 'Update Rating' })).toBeInTheDocument();
    });

    it('shows the server error and keeps the form when saving fails', async () => {
        mockBackend([PAGE], () => json({ success: false, error: 'You can only rate a seller after completing a purchase with them.' }, 403));
        render(<SellerProfile />);

        fireEvent.click(await screen.findByRole('radio', { name: '4 stars' }));
        fireEvent.change(screen.getByLabelText('Review (optional)'), { target: { value: 'Nice' } });
        fireEvent.click(screen.getByRole('button', { name: 'Submit Rating' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('You can only rate a seller after completing a purchase with them.');
        expect(screen.getByLabelText('Review (optional)')).toHaveValue('Nice');
    });

    it('hides the form from buyers without a completed purchase and from the seller', async () => {
        mockBackend([{ ...PAGE, can_rate: false }]);
        const { unmount } = render(<SellerProfile />);
        expect(await screen.findByText('You can rate morgan.keller1 after you complete a purchase with them.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit Rating' })).not.toBeInTheDocument();
        unmount();

        mockBackend([{ ...PAGE, can_rate: false, is_seller: true }]);
        render(<SellerProfile />);
        await screen.findByRole('heading', { name: 'morgan.keller1' });
        expect(screen.queryByText(/You can rate/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Submit Rating' })).not.toBeInTheDocument();
    });

    it('shows a seller with no ratings yet', async () => {
        mockBackend([{ ...PAGE, averageRating: null, ratingCount: 0, ratings: [] }]);
        render(<SellerProfile />);
        expect(await screen.findByText('No ratings yet')).toBeInTheDocument();
        expect(screen.getByText('morgan.keller1 has no reviews yet.')).toBeInTheDocument();
    });

    it('shows the server error for a missing seller', async () => {
        mockBackend([{ success: false, error: 'Seller not found.' }]);
        render(<SellerProfile />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Seller not found.');
    });
});
