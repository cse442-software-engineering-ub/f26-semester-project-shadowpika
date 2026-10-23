import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import ItemCover from './ItemCover.jsx';
import { fetchListingOwnership, loadListing, meetPageUrl } from './meetingRequests.js';
import HeartIcon from './HeartIcon.jsx';
import { fetchFavoriteStatus, removeFavorite, saveFavorite } from './favorites.js';
import ListingMeetingLocation from './components/ListingMeetingLocation.jsx';

const SEARCH_HREF = './product-search.html';

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

function ItemDetails() {
    const [listing, setListing] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');
    // Buy Now only appears once the server confirms the item belongs to someone else.
    const [canBuy, setCanBuy] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [heartPending, setHeartPending] = useState(false);

    useEffect(() => {
        const listingId = new URLSearchParams(window.location.search).get('listing_id') ?? '';
        let cancelled = false;

        fetchListingOwnership(listingId)
            .then((data) => {
                if (!cancelled) setCanBuy(data.success === true && data.is_owner === false);
            })
            .catch(() => {});

        fetchFavoriteStatus(listingId)
            .then((data) => {
                if (!cancelled) setSaved(data.success === true && data.saved === true);
            })
            .catch(() => {});

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

    // The heart only changes once the server confirms the save or the removal.
    const handleHeartClick = async () => {
        if (heartPending) return;
        setSaveError('');
        setHeartPending(true);
        try {
            if (saved) {
                const data = await removeFavorite(listing.listing_id);
                if (data.success === true) setSaved(false);
                else setSaveError(data.error || 'Could not remove this item.');
            } else {
                const data = await saveFavorite(listing.listing_id);
                if (data.success === true) setSaved(true);
                else setSaveError(data.error || 'Could not save this item.');
            }
        } catch {
            setSaveError('Could not connect to the server.');
        } finally {
            setHeartPending(false);
        }
    };

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <BackToSearch />

                {status === 'loading' && <p className="id-message">Loading item details...</p>}
                {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}

                {status === 'done' && listing && (
                    <article className="id-item">
                        {canBuy && (
                            <button
                                type="button"
                                className={`id-heart${saved ? ' is-saved' : ''}`}
                                aria-label="Save to Favorites"
                                aria-pressed={saved}
                                title={saved ? 'Remove from Favorites' : 'Add to Favorites'}
                                onClick={handleHeartClick}
                            >
                                <HeartIcon filled={saved} />
                            </button>
                        )}
                        <div className="id-cover">
                            <ItemCover name={listing.name} imageUrl={listing.image_url} />
                        </div>

                        <div className="id-info">
                            {listing.category && <span className="id-category">{listing.category.toUpperCase()}</span>}
                            <h1 className="id-name">{listing.name}</h1>
                            <p className="id-price">${listing.price}</p>
                            {saveError && <p className="id-error id-save-error" role="alert">{saveError}</p>}

                            {canBuy && (
                                <div className="id-actions">
                                    <button
                                        type="button"
                                        className="id-buy"
                                        onClick={() => window.location.assign(meetPageUrl(listing.listing_id))}
                                    >
                                        Buy Now
                                    </button>
                                    <button
                                        type="button"
                                        className="id-message-seller"
                                        onClick={() => {
                                            if (!listing.owner_id) {
                                                window.alert('Seller information is unavailable.');
                                                return;
                                            }
                                            const parameters = new URLSearchParams({
                                                with: String(listing.owner_id),
                                                listing_id: String(listing.listing_id),
                                                listing_name: listing.name,
                                            });
                                            window.location.assign(`./message.html?${parameters}`);
                                        }}
                                    >
                                        Message Seller
                                    </button>
                                </div>
                            )}

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
                        <ListingMeetingLocation listing={listing} />
                    </article>
                )}
            </main>
        </div>
    );
}

export default ItemDetails;
