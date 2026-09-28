import React, { useState } from 'react';
import './ProductSearch.css';

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

function ProductSearch() {
    const [query, setQuery] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
    };

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
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search products"
                    />
                    <button type="submit" className="ps-search-btn" aria-label="Search">
                        <SearchIcon />
                    </button>
                </form>
            </main>
        </div>
    );
}

export default ProductSearch;
