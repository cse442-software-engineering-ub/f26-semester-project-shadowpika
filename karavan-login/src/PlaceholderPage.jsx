import React from 'react';
import NavBar from './NavBar.jsx';
// Reuses the search page's frame and title styles so the heading sits in the same spot.
import './ProductSearch.css';

// Nav bar plus a page heading, for pages that aren't built out yet.
function PlaceholderPage({ title }) {
    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame">
                <h1 className="ps-title">{title}</h1>
            </main>
        </div>
    );
}

export default PlaceholderPage;
