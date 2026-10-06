import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import { buildItemDetailsUrl, findLocalListing } from './localListings.js';

const SEARCH_HREF = './product-search.html';

const isLocalPreview = () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// LOCAL PREVIEW MODE answers from the seed rows because `npm run dev` can't run PHP.
async function loadListing(listingId) {
    if (isLocalPreview()) {
        const listing = findLocalListing(listingId);
        return listing ? { success: true, listing } : { success: false, error: 'Listing not found.' };
    }
    const response = await fetch(buildItemDetailsUrl(listingId));
    return response.json();
}

// Returns to the search results the shopper came from, so the browser restores their search.
function BackToSearch() {
    const handleClick = (e) => {
        if (document.referrer.includes('product-search.html') && window.history.length > 1) {
            e.preventDefault();
            window.history.back();
        }
    };
    return (
        <a className="id-back" href={SEARCH_HREF} onClick={handleClick}>
            <span aria-hidden="true">←</span> Back to search
        </a>
    );
}

// Listing photo, falling back to a drawn book cover when the image is missing or won't load.
function ItemCover({ name, imageUrl }) {
    const [failed, setFailed] = useState(!imageUrl);

    if (!failed) {
        return (
            <img
                className="ps-book-img"
                src={imageUrl}
                alt={`${name} listing`}
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

function ItemDetails() {
    const [listing, setListing] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');

    useEffect(() => {
        const listingId = new URLSearchParams(window.location.search).get('listing_id') ?? '';
        let cancelled = false;

        loadListing(listingId)
            .then((data) => {
                if (cancelled) return;
                if (data.success && data.listing) {
                    setListing(data.listing);
                    setStatus('done');
                    document.title = `Karavan - ${data.listing.name}`;
                } else {
                    setError(data.error || 'This item could not be loaded.');
                    setStatus('error');
                }
            })
            .catch(() => {
                if (cancelled) return;
                setError('Could not connect to the server.');
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <BackToSearch />

                {status === 'loading' && <p className="id-message">Loading item details...</p>}
                {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}

                {status === 'done' && listing && (
                    <article className="id-item">
                        <div className="id-cover">
                            <ItemCover name={listing.name} imageUrl={listing.image_url} />
                        </div>

                        <div className="id-info">
                            {listing.category && <span className="id-category">{listing.category.toUpperCase()}</span>}
                            <h1 className="id-name">{listing.name}</h1>
                            <p className="id-price">${listing.price}</p>

                            <dl className="id-facts">
                                <div>
                                    <dt>Condition</dt>
                                    <dd><span className="id-condition">{listing.condition}</span></dd>
                                </div>
                            </dl>

                            <section className="id-description">
                                <h2>Description</h2>
                                {listing.description
                                    ? <p>{listing.description}</p>
                                    : <p className="id-muted">The seller didn't add a description.</p>}
                            </section>
                        </div>
                    </article>
                )}
            </main>
        </div>
    );
}

export default ItemDetails;
