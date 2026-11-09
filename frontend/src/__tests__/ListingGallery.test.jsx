import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import ListingGallery from '../ListingGallery.jsx';

it('switches ordered images with accessible thumbnail buttons and resets for another listing', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListingGallery name="Book" imageUrls={['front.jpg','back.png','side.webp']} />);
    expect(screen.getByRole('img', { name: 'Book listing' })).toHaveAttribute('src','front.jpg');
    await user.click(screen.getByRole('button',{name:'View photo 2'}));
    expect(screen.getByRole('img', { name: 'Book listing' })).toHaveAttribute('src','back.png');
    expect(screen.getByRole('button',{name:'View photo 2'})).toHaveAttribute('aria-pressed','true');
    screen.getByRole('button',{name:'View photo 3'}).focus(); await user.keyboard('{Enter}');
    expect(screen.getByText('Photo 3 of 3')).toBeInTheDocument();
    rerender(<ListingGallery name="Other" imageUrls={['new.jpg','other.jpg']} />);
    expect(screen.getByRole('img',{name:'Other listing'})).toHaveAttribute('src','new.jpg');
});
it('supports legacy single and empty listings, and recovers from a broken image on selection', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ListingGallery name="Old" imageUrl="legacy.jpg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src','legacy.jpg');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ListingGallery name="Empty" />); expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<ListingGallery name="Book" imageUrls={['broken.jpg','good.jpg']} />);
    fireEvent.error(screen.getByRole('img',{name:'Book listing'}));
    expect(screen.queryByRole('img',{name:'Book listing'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'View photo 2'}));
    expect(screen.getByRole('img',{name:'Book listing'})).toHaveAttribute('src','good.jpg');
});
