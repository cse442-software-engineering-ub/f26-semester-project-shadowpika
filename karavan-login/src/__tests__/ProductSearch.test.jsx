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

describe('ProductSearch condition filtering', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/product-search.html');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the five canonical condition controls instead of a generic Used option', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        for (const condition of ['New', 'Like New', 'Good', 'Fair', 'Acceptable']) {
            expect(screen.getByRole('button', { name: condition })).toHaveAttribute('aria-pressed', 'false');
        }
        expect(screen.queryByRole('button', { name: 'Used' })).not.toBeInTheDocument();
    });

    it('keeps condition selections as drafts until Apply Filters is clicked', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        const likeNew = screen.getByRole('button', { name: 'Like New' });
        fireEvent.click(likeNew);
        expect(likeNew).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Conditions: Like New')).toBeInTheDocument();
        expect(screen.getByText('3 items found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();
        expect(screen.getByText('Genetics: A Conceptual Approach')).toBeInTheDocument();
        expect(screen.getByText('Introduction to Algorithms')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Textbook')).not.toBeInTheDocument();
    });

    it('uses OR for multiple selected conditions', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('button', { name: 'Like New' }));
        fireEvent.click(screen.getByRole('button', { name: 'Acceptable' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Conditions: Like New, Acceptable')).toBeInTheDocument();
        expect(screen.getByText('4 items found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();
        expect(screen.getByText('Campbell Biology')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Textbook')).not.toBeInTheDocument();
    });

    it('combines categories and conditions with AND', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Textbooks' }));
        fireEvent.click(screen.getByRole('button', { name: 'Good' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Categories: Textbooks · Conditions: Good')).toBeInTheDocument();
        expect(screen.getByText('3 items found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Physical Chemistry')).toBeInTheDocument();
        expect(screen.getByText('Organic Chemistry Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Desk Lamp')).not.toBeInTheDocument();
    });

    it('combines the product-name query with conditions and preserves the query', async () => {
        render(<ProductSearch />);
        await finishSearch();
        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('button', { name: 'Good' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(searchInput).toHaveValue('Calculus');
        expect(screen.getByText('1 item found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Workbook')).not.toBeInTheDocument();
    });

    it('clears condition filters without clearing the product-name query', async () => {
        render(<ProductSearch />);
        await finishSearch();
        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('button', { name: 'Good' }));
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

describe('ProductSearch price filtering', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.history.replaceState({}, '', '/product-search.html');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('provides enabled and labeled minimum and maximum controls', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        expect(screen.getByRole('spinbutton', { name: 'Minimum price ($)' })).toBeEnabled();
        expect(screen.getByRole('spinbutton', { name: 'Maximum price ($)' })).toBeEnabled();
        expect(screen.getByText('Any price')).toBeInTheDocument();
    });

    it('keeps price entries as drafts and applies inclusive boundaries', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price ($)' }), {
            target: { value: '35.00' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price ($)' }), {
            target: { value: '50.00' },
        });

        expect(screen.getByText('$35.00 to $50.00')).toBeInTheDocument();
        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('9 items found')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Price: $35.00 to $50.00')).toBeInTheDocument();
        expect(screen.getByText('4 items found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.getByText('Organic Chemistry Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Workbook')).not.toBeInTheDocument();
        expect(screen.queryByText('Campbell Biology')).not.toBeInTheDocument();
    });

    it('supports minimum-only and maximum-only filtering', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));

        const minimum = screen.getByRole('spinbutton', { name: 'Minimum price ($)' });
        const maximum = screen.getByRole('spinbutton', { name: 'Maximum price ($)' });
        fireEvent.change(minimum, { target: { value: '50' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Price: $50.00 and up')).toBeInTheDocument();
        expect(screen.getByText('4 items found')).toBeInTheDocument();
        expect(screen.getByText('Organic Chemistry Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Introduction to Algorithms')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
        await finishSearch();
        fireEvent.change(maximum, { target: { value: '20' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Price: Up to $20.00')).toBeInTheDocument();
        expect(screen.getByText('2 items found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Workbook')).toBeInTheDocument();
        expect(screen.getByText('Desk Lamp')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Textbook')).not.toBeInTheDocument();
    });

    it('combines product-name search and price bounds with AND', async () => {
        render(<ProductSearch />);
        await finishSearch();
        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price ($)' }), {
            target: { value: '25' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price ($)' }), {
            target: { value: '40' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(searchInput).toHaveValue('Calculus');
        expect(screen.getByText('1 item found')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Workbook')).not.toBeInTheDocument();
    });

    it('combines category, condition, and price filters with AND', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Textbooks' }));
        fireEvent.click(screen.getByRole('button', { name: 'Like New' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price ($)' }), {
            target: { value: '40' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price ($)' }), {
            target: { value: '45' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('Categories: Textbooks · Conditions: Like New · Price: $40.00 to $45.00')).toBeInTheDocument();
        expect(screen.getByText('2 items found')).toBeInTheDocument();
        expect(screen.getByText('Introduction to Algorithms')).toBeInTheDocument();
        expect(screen.getByText('Genetics: A Conceptual Approach')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Workbook')).not.toBeInTheDocument();
    });

    it('rejects an inverted range without replacing the applied results', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        const minimum = screen.getByRole('spinbutton', { name: 'Minimum price ($)' });
        const maximum = screen.getByRole('spinbutton', { name: 'Maximum price ($)' });

        fireEvent.change(minimum, { target: { value: '35' } });
        fireEvent.change(maximum, { target: { value: '50' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();
        expect(screen.getByText('4 items found')).toBeInTheDocument();

        fireEvent.change(minimum, { target: { value: '75' } });
        fireEvent.change(maximum, { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Minimum price cannot be greater than maximum price.');
        expect(minimum).toHaveValue(75);
        expect(maximum).toHaveValue(10);
        expect(screen.getByText('4 items found')).toBeInTheDocument();
        expect(screen.getByText('Price: $35.00 to $50.00')).toBeInTheDocument();
    });

    it('uses the existing empty state for a valid range with no matches', async () => {
        render(<ProductSearch />);
        await finishSearch();
        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price ($)' }), {
            target: { value: '1000' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price ($)' }), {
            target: { value: '2000' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();

        expect(screen.getByText('0 items found')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'No Active Listings' })).toBeInTheDocument();
        expect(screen.getByText('Showing no matches on campus')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close filters' })).toBeEnabled();
    });

    it('clears prices and other filters without clearing the product-name query', async () => {
        render(<ProductSearch />);
        await finishSearch();
        const searchInput = screen.getByRole('textbox', { name: 'Search products' });
        fireEvent.change(searchInput, { target: { value: 'Calculus' } });
        await finishSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open filters' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price ($)' }), {
            target: { value: '30' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price ($)' }), {
            target: { value: '40' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
        await finishSearch();
        expect(screen.getByText('1 item found')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
        await finishSearch();

        expect(searchInput).toHaveValue('Calculus');
        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('2 items found')).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: 'Minimum price ($)' })).toHaveValue(null);
        expect(screen.getByRole('spinbutton', { name: 'Maximum price ($)' })).toHaveValue(null);
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

    it('restores valid conditions from the address and ignores unknown ones', async () => {
        window.history.replaceState({}, '', '/product-search.html?conditions=Good,Used');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByText('Conditions: Good')).toBeInTheDocument();
        expect(screen.getByText('Calculus Textbook')).toBeInTheDocument();
        expect(screen.queryByText('Calculus Workbook')).not.toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).get('conditions')).toBe('Good');
    });

    it('restores valid price bounds from the address and normalizes them', async () => {
        window.history.replaceState({}, '', '/product-search.html?min_price=35&max_price=50');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByText('Price: $35.00 to $50.00')).toBeInTheDocument();
        expect(screen.getByText('4 items found')).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).get('min_price')).toBe('35.00');
        expect(new URLSearchParams(window.location.search).get('max_price')).toBe('50.00');
    });

    it('ignores invalid price bounds in the address', async () => {
        window.history.replaceState({}, '', '/product-search.html?min_price=-1&max_price=10000');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('9 items found')).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).has('min_price')).toBe(false);
        expect(new URLSearchParams(window.location.search).has('max_price')).toBe(false);
    });

    it('does not apply an inverted price range from the address', async () => {
        window.history.replaceState({}, '', '/product-search.html?min_price=75&max_price=10');
        render(<ProductSearch />);
        await finishSearch();

        expect(screen.getByText('No Filters Active')).toBeInTheDocument();
        expect(screen.getByText('9 items found')).toBeInTheDocument();
        expect(new URLSearchParams(window.location.search).has('min_price')).toBe(false);
        expect(new URLSearchParams(window.location.search).has('max_price')).toBe(false);
    });
});

describe('listing search helpers', () => {
    it('builds the category API request without losing the product-name query', () => {
        const url = buildSearchUrl('Calculus', ['Textbooks', 'Dorm Living']);
        expect(url).toBe('./api/search_listings.php?q=Calculus&categories=Textbooks%2CDorm+Living');
    });

    it('builds one API request containing keyword, category, and condition filters', () => {
        const url = buildSearchUrl('Calculus', ['Textbooks'], ['Like New', 'Good']);
        expect(url).toBe('./api/search_listings.php?q=Calculus&categories=Textbooks&conditions=Like+New%2CGood');
    });

    it('builds one API request containing all applied filters and price bounds', () => {
        const url = buildSearchUrl('Calculus', ['Textbooks'], ['Good'], '25.00', '40.00');
        expect(url).toBe('./api/search_listings.php?q=Calculus&categories=Textbooks&conditions=Good&min_price=25.00&max_price=40.00');
    });

    it('returns no inactive rows and normalizes legacy local categories', () => {
        const results = searchLocalListings('', ['Textbooks']);
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((listing) => listing.category === 'Textbooks')).toBe(true);
        expect(results.some((listing) => listing.listing_id === 91004)).toBe(false);
    });

    it('filters local listings by condition and intersects condition with category', () => {
        const likeNew = searchLocalListings('', [], ['Like New']);
        expect(likeNew.length).toBeGreaterThan(0);
        expect(likeNew.every((listing) => listing.condition === 'Like New')).toBe(true);

        const textbookGood = searchLocalListings('', ['Textbooks'], ['Good']);
        expect(textbookGood.length).toBeGreaterThan(0);
        expect(textbookGood.every((listing) => listing.category === 'Textbooks' && listing.condition === 'Good')).toBe(true);
        expect(textbookGood.some((listing) => listing.name === 'Desk Lamp')).toBe(false);
    });

    it('filters local listings with inclusive optional price bounds', () => {
        const bounded = searchLocalListings('', [], [], '35.00', '50.00');
        expect(bounded.map((listing) => listing.price)).toEqual(['35.00', '45.00', '50.00', '40.00']);

        const minimumOnly = searchLocalListings('', [], [], '50.00');
        expect(minimumOnly.every((listing) => Number(listing.price) >= 50)).toBe(true);

        const maximumOnly = searchLocalListings('', [], [], '', '20.00');
        expect(maximumOnly.every((listing) => Number(listing.price) <= 20)).toBe(true);
        expect(maximumOnly.some((listing) => listing.listing_id === 91004)).toBe(false);
    });
});
