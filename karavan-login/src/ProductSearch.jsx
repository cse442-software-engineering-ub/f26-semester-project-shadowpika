import React, { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import { buildSearchUrl, itemPageUrl, searchLocalListings } from './localListings.js';

const MAX_QUERY_LENGTH = 50;
const SEARCH_DELAY_MS = 300;
const LOCAL_LISTING_KEY = 'karavan:last-created-listing';
const CATEGORY_OPTIONS = [
    'Textbooks',
    'Tech & Electronics',
    'Dorm Living',
    'Clothing & Gear',
    'Other',
];

// Emoji, pictographs, flags, and the joiners/variation selectors used to build them.
// Kept in sync with the pattern in api/search_listings.php.
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}\u{3030}\u{303D}\u{3297}\u{3299}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Strips emoji and caps the length, returning the notice to show when anything was removed.
function cleanQuery(typed) {
    let cleaned = typed.replace(EMOJI_PATTERN, '');
    let notice = cleaned !== typed ? 'Emoji are not allowed in search.' : '';

    const chars = Array.from(cleaned);
    if (chars.length > MAX_QUERY_LENGTH) {
        cleaned = chars.slice(0, MAX_QUERY_LENGTH).join('');
        notice = `Search is limited to ${MAX_QUERY_LENGTH} characters.`;
    }
    return { cleaned, notice };
}

// The search lives in the address (?q=...&categories=...) so the browser's Back button
// returns from an item page to the same results.
const searchParams = () => new URLSearchParams(window.location.search);
const initialQuery = () => cleanQuery(searchParams().get('q') ?? '').cleaned;
const initialCategories = () => (searchParams().get('categories') ?? '')
    .split(',')
    .filter((category) => CATEGORY_OPTIONS.includes(category));

function saveSearchInAddress(query, categories) {
    const params = searchParams();
    if (query.trim()) params.set('q', query);
    else params.delete('q');
    if (categories.length > 0) params.set('categories', categories.join(','));
    else params.delete('categories');

    const queryString = params.toString();
    const url = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
}

function FilterIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="4" x2="6" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="18" y1="4" x2="18" y2="20" />
            <line x1="3.5" y1="15" x2="8.5" y2="15" />
            <line x1="9.5" y1="9" x2="14.5" y2="9" />
            <line x1="15.5" y1="14" x2="20.5" y2="14" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7" />
            <line x1="15.8" y1="15.8" x2="21" y2="21" />
        </svg>
    );
}

// Listing photo, falling back to a drawn book cover when the image is missing.
function BookCover({ name, imageUrl }) {
    const [failed, setFailed] = useState(!imageUrl);

    if (!failed) {
        return (
            <img
                className="ps-book-img"
                src={imageUrl}
                alt={`${name} listing`}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <div className="ps-book-placeholder" aria-hidden="true">
            <div className="ps-book-spine" />
            <div className="ps-book-face">
                <span className="ps-book-band" />
                <span className="ps-book-title">{name}</span>
                <span className="ps-book-band" />
            </div>
        </div>
    );
}

function BookCard({ book, isOwner = false }) {
    return (
        <article className="ps-book-card">
            <div className="ps-book-cover">
                <BookCover key={book.image_url || 'placeholder'} name={book.name} imageUrl={book.image_url} />
            </div>
            <div className="ps-book-body">
                {isOwner && (
                    <span className="ps-owner-label">YOUR LISTING · {book.category || 'MARKETPLACE'}</span>
                )}
                <h3 className="ps-book-name" title={book.name}>
                    {/* Stretched over the whole card, so clicking anywhere on it opens the item */}
                    <a className="ps-book-link" href={itemPageUrl(book.listing_id)}>{book.name}</a>
                </h3>
                <div className="ps-book-meta">
                    <span className="ps-book-price">${book.price}</span>
                    <span className="ps-book-condition">{book.condition}</span>
                </div>
                {isOwner && (
                    <button
                        type="button"
                        className="ps-manage-button"
                        disabled
                        title="Listing management will be added in a separate task."
                    >
                        Manage
                    </button>
                )}
            </div>
        </article>
    );
}

function ProductSearch() {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');
    const [inputNotice, setInputNotice] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draftCategories, setDraftCategories] = useState(initialCategories);
    const [appliedCategories, setAppliedCategories] = useState(initialCategories);
    const [publishedListing, setPublishedListing] = useState(null);
    const [publishedStatus, setPublishedStatus] = useState('idle');
    const requestId = useRef(0);

    useEffect(() => {
        const publishedId = new URLSearchParams(window.location.search).get('published');
        if (!publishedId || !/^\d+$/.test(publishedId)) return;

        let cancelled = false;
        const loadPublishedListing = async () => {
            setPublishedStatus('loading');
            try {
                let listing;
                if (isLocalPreview()) {
                    const storedListing = localStorage.getItem(LOCAL_LISTING_KEY);
                    listing = storedListing ? JSON.parse(storedListing) : null;
                    if (!listing || String(listing.listing_id) !== publishedId) {
                        throw new Error('The newly created listing could not be loaded.');
                    }
                } else {
                    const response = await fetch(`./listing/api/get_listing.php?listing_id=${encodeURIComponent(publishedId)}`);
                    const data = await response.json();
                    if (!response.ok || !data.success) {
                        throw new Error(data.error || 'The newly created listing could not be loaded.');
                    }
                    listing = data.listing;
                }

                if (!cancelled) {
                    setPublishedListing({ ...listing, name: listing.name || listing.title });
                    setPublishedStatus('done');
                }
            } catch {
                if (!cancelled) setPublishedStatus('error');
            }
        };

        loadPublishedListing();
        return () => {
            cancelled = true;
        };
    }, []);

    const runSearch = useCallback(async (rawTerm, categories) => {
        const term = rawTerm.trim();
        const id = ++requestId.current;

        setStatus('loading');
        setError('');

        // 1. LOCAL PREVIEW MODE
        if (isLocalPreview()) {
            setResults(searchLocalListings(term, categories));
            setStatus('done');
            return;
        }

        // 2. PRODUCTION MODE
        try {
            const response = await fetch(buildSearchUrl(term, categories));
            const data = await response.json();
            if (id !== requestId.current) return; // a newer search has started
            if (response.ok && data.success) {
                setResults(data.results);
                setStatus('done');
            } else {
                setResults([]);
                setError(data.error || 'Search failed.');
                setStatus('error');
            }
        } catch {
            if (id !== requestId.current) return;
            setResults([]);
            setError('Could not connect to the server.');
            setStatus('error');
        }
    }, []);

    // Load active listings on entry and refresh after the user pauses typing or applies categories.
    useEffect(() => {
        const timer = setTimeout(() => runSearch(query, appliedCategories), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [query, appliedCategories, runSearch]);

    useEffect(() => {
        saveSearchInAddress(query, appliedCategories);
    }, [query, appliedCategories]);

    const handleChange = (e) => {
        const { cleaned, notice } = cleanQuery(e.target.value);
        setInputNotice(notice);
        setQuery(cleaned);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        runSearch(query, appliedCategories);
    };

    const toggleFilters = () => {
        setFiltersOpen((isOpen) => {
            if (!isOpen) setDraftCategories(appliedCategories);
            return !isOpen;
        });
    };

    const toggleDraftCategory = (category) => {
        setDraftCategories((current) => current.includes(category)
            ? current.filter((selected) => selected !== category)
            : [...current, category]);
    };

    const applyFilters = () => {
        setAppliedCategories([...draftCategories]);
    };

    const clearFilters = () => {
        setDraftCategories([]);
        setAppliedCategories([]);
    };

    const term = query.trim();
    const charCount = Array.from(query).length;
    const filterStatus = appliedCategories.length === 0
        ? 'No Filters Active'
        : `Categories: ${appliedCategories.join(', ')}`;
    const publishedResultVisible = publishedListing
        && results.some((listing) => String(listing.listing_id) === String(publishedListing.listing_id));
    const marketplaceResults = publishedResultVisible
        ? results.filter((listing) => String(listing.listing_id) !== String(publishedListing.listing_id))
        : results;

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame">
                <div className={`ps-marketplace-layout${filtersOpen ? ' filters-open' : ''}`}>
                    <div className="ps-marketplace-main">
                        <div className="ps-search-row">
                            <form className="ps-search" onSubmit={handleSearch} role="search">
                                <button
                                    type="button"
                                    className={`ps-filter-btn${filtersOpen ? ' is-active' : ''}`}
                                    aria-label={filtersOpen ? 'Close filters' : 'Open filters'}
                                    aria-expanded={filtersOpen}
                                    aria-controls="ps-filters-panel"
                                    onClick={toggleFilters}
                                >
                                    <FilterIcon />
                                </button>
                                <input
                                    type="text"
                                    className="ps-search-input"
                                    placeholder="Search textbooks, tech, dorm gear..."
                                    value={query}
                                    onChange={handleChange}
                                    maxLength={MAX_QUERY_LENGTH * 2}
                                    aria-label="Search products"
                                    aria-describedby="ps-search-help"
                                />
                                <button type="submit" className="ps-search-btn" aria-label="Search">
                                    <SearchIcon />
                                </button>
                            </form>
                            <div className={`ps-filter-status${appliedCategories.length > 0 ? ' is-active' : ''}`} aria-live="polite">
                                {filterStatus}
                            </div>
                        </div>
                        <div id="ps-search-help" className="ps-search-help" aria-live="polite">
                            <span className="ps-search-notice">{inputNotice}</span>
                            {charCount > 0 && <span className="ps-search-count">{charCount}/{MAX_QUERY_LENGTH}</span>}
                        </div>

                        {publishedStatus !== 'idle' && (
                            <section className="ps-published-section" aria-live="polite">
                                {publishedStatus === 'loading' && (
                                    <div className="ps-published-banner">Loading your newly published listing…</div>
                                )}
                                {publishedStatus === 'error' && (
                                    <div className="ps-published-banner ps-published-error">
                                        Your listing was published, but its marketplace card could not be loaded.
                                    </div>
                                )}
                                {publishedStatus === 'done' && publishedListing && (
                                    <>
                                        <div className="ps-published-banner">
                                            <span aria-hidden="true">✓</span> Your listing was published.
                                        </div>
                                        {publishedResultVisible && (
                                            <div className="ps-book-grid ps-published-grid">
                                                <BookCard book={publishedListing} isOwner />
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        )}

                        <section className="ps-results" aria-live="polite" aria-busy={status === 'loading'}>
                            <div className="ps-results-header">
                                <div>
                                    <h2 className="ps-results-label">Active Listings</h2>
                                    <p className="ps-results-context">
                                        {term ? `Matches for “${term}”` : 'Showing active items on campus'}
                                    </p>
                                </div>
                                {status === 'done' && (
                                    <span className="ps-results-count">
                                        {results.length} {results.length === 1 ? 'item' : 'items'} found
                                    </span>
                                )}
                            </div>

                            {status === 'loading' && <p className="ps-results-message">Loading active listings...</p>}
                            {status === 'error' && <p className="ps-results-message ps-results-error">{error}</p>}
                            {status === 'done' && results.length === 0 && (
                                <div className="ps-empty-state">
                                    <h3>No Active Listings</h3>
                                    <p>Showing no matches on campus</p>
                                </div>
                            )}
                            {status === 'done' && results.length > 0 && marketplaceResults.length > 0 && (
                                <div className="ps-book-grid">
                                    {marketplaceResults.map((book) => (
                                        <BookCard key={book.listing_id} book={book} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {filtersOpen && (
                        <aside id="ps-filters-panel" className="ps-filters-panel" aria-label="Filters">
                            <div className="ps-filters-header">
                                <h2><FilterIcon /> Filters</h2>
                                <div className="ps-filter-header-actions">
                                    <button type="button" className="ps-clear-filters" onClick={clearFilters}>Clear All</button>
                                    <button
                                        type="button"
                                        className="ps-close-filters"
                                        aria-label="Close filters panel"
                                        onClick={() => setFiltersOpen(false)}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            <fieldset className="ps-filter-group">
                                <legend>Category</legend>
                                {CATEGORY_OPTIONS.map((category) => (
                                    <label className="ps-category-option" key={category}>
                                        <input
                                            type="checkbox"
                                            checked={draftCategories.includes(category)}
                                            onChange={() => toggleDraftCategory(category)}
                                        />
                                        <span>{category}</span>
                                    </label>
                                ))}
                            </fieldset>

                            <fieldset className="ps-filter-group ps-placeholder-filter" disabled>
                                <legend>Price Range</legend>
                                <input type="range" min="0" max="100" value="50" readOnly aria-label="Price range" />
                                <div className="ps-price-values"><span>$10.00</span><span>to</span><span>$75.00</span></div>
                            </fieldset>

                            <fieldset className="ps-filter-group ps-placeholder-filter" disabled>
                                <legend>Condition</legend>
                                <div className="ps-condition-options">
                                    <button type="button" disabled>New</button>
                                    <button type="button" className="is-selected" disabled>Like New</button>
                                    <button type="button" disabled>Used</button>
                                </div>
                            </fieldset>

                            <fieldset className="ps-filter-group ps-placeholder-filter" disabled>
                                <legend>Sort By</legend>
                                <label><input type="radio" name="sort-placeholder" checked readOnly /> Newest Listings</label>
                                <label><input type="radio" name="sort-placeholder" readOnly /> Price: Low to High</label>
                                <label><input type="radio" name="sort-placeholder" readOnly /> Price: High to Low</label>
                            </fieldset>

                            <button type="button" className="ps-apply-filters" onClick={applyFilters}>Apply Filters</button>
                        </aside>
                    )}
                </div>
            </main>
        </div>
    );
}

export default ProductSearch;
