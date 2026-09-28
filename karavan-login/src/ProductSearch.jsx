import React, { useEffect, useRef, useState } from 'react';
import './ProductSearch.css';
import { searchLocalListings } from './localListings.js';

const MAX_QUERY_LENGTH = 50;
const SEARCH_DELAY_MS = 300;

// Emoji, pictographs, flags, and the joiners/variation selectors used to build them.
// Kept in sync with the pattern in api/search_listings.php.
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}\u{3030}\u{303D}\u{3297}\u{3299}]|\u{FE0F}|\u{200D}|\u{20E3}/gu;

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
        return <img className="ps-book-img" src={imageUrl} alt={name} onError={() => setFailed(true)} />;
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

function BookCard({ book }) {
    return (
        <article className="ps-book-card">
            <div className="ps-book-cover">
                <BookCover name={book.name} imageUrl={book.image_url} />
            </div>
            <div className="ps-book-body">
                <h3 className="ps-book-name" title={book.name}>{book.name}</h3>
                <div className="ps-book-meta">
                    <span className="ps-book-price">${book.price}</span>
                    <span className="ps-book-condition">{book.condition}</span>
                </div>
            </div>
        </article>
    );
}

function ProductSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [status, setStatus] = useState('idle'); // idle | loading | done | error
    const [error, setError] = useState('');
    const [inputNotice, setInputNotice] = useState('');
    const requestId = useRef(0);

    const runSearch = async (rawTerm) => {
        const term = rawTerm.trim();
        const id = ++requestId.current;

        if (!term) {
            setResults([]);
            setStatus('idle');
            setError('');
            return;
        }

        setStatus('loading');
        setError('');

        // 1. LOCAL PREVIEW MODE
        if (isLocalPreview()) {
            setResults(searchLocalListings(term));
            setStatus('done');
            return;
        }

        // 2. PRODUCTION MODE
        try {
            const response = await fetch(`./api/search_listings.php?q=${encodeURIComponent(term)}`);
            const data = await response.json();
            if (id !== requestId.current) return; // a newer search has started
            if (data.success) {
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
    };

    // Search as the user types, once they pause.
    useEffect(() => {
        const timer = setTimeout(() => runSearch(query), SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [query]);

    const handleChange = (e) => {
        const typed = e.target.value;
        let cleaned = typed.replace(EMOJI_PATTERN, '');
        let notice = cleaned !== typed ? 'Emoji are not allowed in search.' : '';

        const chars = Array.from(cleaned);
        if (chars.length > MAX_QUERY_LENGTH) {
            cleaned = chars.slice(0, MAX_QUERY_LENGTH).join('');
            notice = `Search is limited to ${MAX_QUERY_LENGTH} characters.`;
        }

        setInputNotice(notice);
        setQuery(cleaned);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        runSearch(query);
    };

    const term = query.trim();
    const charCount = Array.from(query).length;

    return (
        <div className="ps-page">
            <main className="ps-frame">
                <h1 className="ps-title">Find what you need</h1>
                <p className="ps-subtitle">Buy, sell, and support classmates directly on campus.</p>

                <form className="ps-search" onSubmit={handleSearch} role="search">
                    <button type="button" className="ps-filter-btn" aria-label="Filters">
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
                <div id="ps-search-help" className="ps-search-help" aria-live="polite">
                    <span className="ps-search-notice">{inputNotice}</span>
                    {charCount > 0 && <span className="ps-search-count">{charCount}/{MAX_QUERY_LENGTH}</span>}
                </div>

                {status !== 'idle' && (
                    <section className="ps-results" aria-live="polite">
                        <div className="ps-results-header">
                            <h2 className="ps-results-label">Books</h2>
                            {status === 'done' && (
                                <span className="ps-results-count">
                                    {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{term}&rdquo;
                                </span>
                            )}
                        </div>

                        {status === 'loading' && <p className="ps-results-message">Searching...</p>}
                        {status === 'error' && <p className="ps-results-message ps-results-error">{error}</p>}
                        {status === 'done' && results.length === 0 && (
                            <p className="ps-results-message">No books found for &ldquo;{term}&rdquo;. Try another title or subject.</p>
                        )}
                        {status === 'done' && results.length > 0 && (
                            <div className="ps-book-grid">
                                {results.map((book) => (
                                    <BookCard key={book.listing_id} book={book} />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

export default ProductSearch;
