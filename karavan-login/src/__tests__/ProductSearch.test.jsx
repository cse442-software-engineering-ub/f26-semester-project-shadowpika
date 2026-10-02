import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductSearch from '../ProductSearch.jsx';
import { buildSearchUrl, searchLocalListings } from '../localListings.js';

vi.mock('../NavBar.jsx', () => ({
    default: () => <nav aria-label="Main">Karavan navigation</nav>,
}));

async function finishSearch() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
    });
}

describe('ProductSearch category filtering', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/product-search.html');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('loads active listings and opens and closes the existing Filters panel', async () => {
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByRole('heading', { name: 'Active Listings' })).toBeInTheDocument();
        expect(screen.getByText('9 items found')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Textbooks' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Tech & Electronics' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Dorm Living' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Clothing & Gear' })).toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: 'Other' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Close filters panel' }));
        expect(screen.queryByRole('complementary', { name: 'Filters' })).not.toBeInTheDocument();
    });

    it('does not filter draft selections until Apply Filters is clicked', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        fireEvent.click(screen.getByRole('checkbox', { name: 'Textbooks' }));
        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('Desk Lamp')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Categories: Textbooks')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Desk Lamp')).not.toBeInTheDocument();
        expect(screen.queryByText('Dorm Fridge')).not.toBeInTheDocument();
    });

    it('uses OR for multiple categories', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Textbooks' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Dorm Living' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Categories: Textbooks, Dorm Living')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Desk Lamp')).toBeInTheDocument();
        expect(screen.getByText('Dorm Fridge')).toBeInTheDocument();
        expect(screen.getByText('9 items found')).toBeInTheDocument();
    });

    it('combines the product-name query with categories and preserves the query', async () => {
        render(<ProductSearch />);
        await finishSearch();

        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Dorm Living' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(searchInput).toHaveValue('Calculus');
        expect(screen.getByText('0 items found')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'No Active Listings' })).toBeInTheDocument();
        expect(screen.getByText('Showing no matches on campus')).toBeInTheDocument();
    });

    it('clears categories without clearing the product-name query', async () => {
        render(<ProductSearch />);
        await finishSearch();
        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Dorm Living' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
        await finishSearch();

        expect(searchInput).toHaveValue('Calculus');
        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();
    });
});

describe('ProductSearch item links and Back button (#151)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/product-search.html');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('links each card to its item-detail page', async () => {
        render(<ProductSearch />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'Calculus' } });
        await finishSearch();

        expect(screen.getByRole('link', { name: 'Calculus Textbook' })).toHaveAttribute('href', './item.html?listing_id=91001');
        expect(screen.getByRole('link', { name: 'Calculus Workbook' })).toHaveAttribute('href', './item.html?listing_id=91002');
    });

    it('keeps the search and categories in the address', async () => {
        render(<ProductSearch />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'Calculus' } });
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Tech & Electronics' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        const params = new URLSearchParams(window.location.search);
        expect(params.get('q')).toBe('Calculus');
        expect(params.get('categories')).toBe('Tech & Electronics');
    });

    it('restores the search from the address when returning with Back', async () => {
        window.history.replaceState({}, '', '/product-search.html?q=Calculus');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByRole('textbox', { name: 'Search products' })).toHaveValue('Calculus');
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();
        expect(screen.queryByText('Desk Lamp')).not.toBeInTheDocument();
    });

    it('ignores unknown categories in the address', async () => {
        window.history.replaceState({}, '', '/product-search.html?categories=Textbooks,Weapons');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByText('Categories: Textbooks')).toBeInTheDocument();
    });
});

describe('listing search helpers', () => {
    it('builds the category API request without losing the product-name query', () => {
        const url = buildSearchUrl('Calculus', ['Textbooks', 'Dorm Living']);
        expect(url).toBe('./api/search_listings.php?q=Calculus&categories=Textbooks%2CDorm+Living');
    });

    it('returns no inactive rows and normalizes legacy local categories', () => {
        const results = searchLocalListings('', ['Textbooks']);
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((listing) => listing.category === 'Textbooks')).toBe(true);
        expect(results.some((listing) => listing.listing_id === 91004)).toBe(false);
    });
});
