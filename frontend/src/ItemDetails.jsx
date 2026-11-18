import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import ListingGallery from './ListingGallery.jsx';
import { fetchListingOwnership, fetchMyMeetingRequests, itemPageFrom, loadListing, meetPageUrl } from './meetingRequests.js';
import HeartIcon from './HeartIcon.jsx';
import { fetchFavoriteStatus, removeFavorite, saveFavorite } from './favorites.js';
import ListingMeetingLocation from './components/ListingMeetingLocation.jsx';
import { recordViewedItem } from './previouslyViewed.js';
import Stars from './components/Stars.jsx';
import { messagePageUrl } from './messages.js';
import { ratingSummaryText, sellerPageUrl } from './ratings.js';
import { shareListing } from './shareListing.js';
import { loadRequestCount } from './requestCount.js';

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

// Opened from a purchase request: back goes to Home.
function BackToHome() {
    return (
        <a className="id-back" href="./home.html">
            <span aria-hidden="true">←</span> Back to home
        </a>
    );
}

// Opened from the Favorites page: back goes to Favorites.
function BackToFavorites() {
    return (
        <a className="id-back" href="./favorites.html">
            <span aria-hidden="true">←</span> Back to favorites
        </a>
    );
}

// Opened from Messages: back goes to Messages.
function BackToMessages() {
    return (
        <a className="id-back" href="./message.html">
            <span aria-hidden="true">←</span> Back to messages
        </a>
    );
}

function ShareIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
        </svg>
    );
}

function PeopleIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20v-1a5.5 5.5 0 0 1 5.5-5.5h2a5.5 5.5 0 0 1 5.5 5.5v1" />
            <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a5.5 5.5 0 0 1 3 5v1" />
        </svg>
    );
}

function ItemDetails() {
    const from = itemPageFrom(window.location.search);
    const [listing, setListing] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');
    // Buy Now only appears once the server confirms the item belongs to someone else.
    const [canBuy, setCanBuy] = useState(false);
    // Buy Now stays hidden while the buyer has an open request (anything but denied) for this item.
    const [requestAllowsBuying, setRequestAllowsBuying] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [heartPending, setHeartPending] = useState(false);
    const [shareNote, setShareNote] = useState({ ok: false, message: '' });
    const [sharePending, setSharePending] = useState(false);
    const [requestCount, setRequestCount] = useState(null);

    useEffect(() => {
        const listingId = new URLSearchParams(window.location.search).get('listing_id') ?? '';
        let cancelled = false;

        fetchListingOwnership(listingId)
            .then((data) => {
                if (!cancelled) setCanBuy(data.success === true && data.is_owner === false);
            })
            .catch(() => {});

        fetchMyMeetingRequests()
            .then((data) => {
                if (cancelled) return;
                setRequestAllowsBuying(
                    data.success === true
                    && Array.isArray(data.requests)
                    && !data.requests.some((request) => String(request.listing_id) === String(listingId) && request.status !== 'denied'),
                );
            })
            .catch(() => {});

        fetchFavoriteStatus(listingId)
            .then((data) => {
                if (!cancelled) setSaved(data.success === true && data.saved === true);
            })
            .catch(() => {});

        loadRequestCount(listingId).then((count) => {
            if (!cancelled) setRequestCount(count);
        });

        loadListing(listingId)
            .then((data) => {
                if (cancelled) return;
                if (data.success && data.listing) {
                    setListing(data.listing);
                    setStatus('done');
                    document.title = `Karavan - ${data.listing.name}`;
                    recordViewedItem(Number(data.listing.listing_id)).catch(() => {});
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

    // One request per click; the earlier message is cleared first and nothing is copied unless it succeeds.
    const handleShareClick = async () => {
        if (sharePending) return;
        setShareNote({ ok: false, message: '' });
        setSharePending(true);
        const result = await shareListing(listing.listing_id);
        setShareNote(result.ok ? { ok: true, message: 'Link copied!' } : { ok: false, message: result.message });
        setSharePending(false);
    };

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame id-page">
                {from === 'favorites' ? <BackToFavorites /> : from === 'request' || from === 'home' ? <BackToHome /> : from === 'messages' ? <BackToMessages /> : <BackToSearch />}

                {status === 'loading' && <p className="id-message">Loading item details...</p>}
                {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}

                {status === 'done' && listing && (
                    <article className="id-item">
                        <div className="id-corner">
                            <div className="id-corner-row">
                                <button
                                    type="button"
                                    className="id-share"
                                    title="Copy a link to this item"
                                    onClick={handleShareClick}
                                    disabled={sharePending}
                                >
                                    <ShareIcon />
                                    <span>Share</span>
                                </button>
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
                            </div>
                            {shareNote.message && (shareNote.ok
                                ? <p className="id-share-note" role="status">{shareNote.message}</p>
                                : <p className="id-share-note id-error" role="alert">{shareNote.message}</p>)}
                        </div>
                        <ListingGallery name={listing.name} imageUrl={listing.image_url} imageUrls={listing.image_urls} />

                        <div className="id-info">
                            {listing.category && <span className="id-category">{listing.category.toUpperCase()}</span>}
                            <h1 className="id-name">{listing.name}</h1>
                            <p className="id-price">${listing.price}</p>
                            {saveError && <p className="id-error id-save-error" role="alert">{saveError}</p>}

                            {listing.seller && (
                                <p className="id-seller">
                                    <span>Sold by <a className="id-seller-link" href={sellerPageUrl(listing.seller.id)}>{listing.seller.username}</a></span>
                                    <span className="id-seller-rating">
                                        <Stars value={listing.seller.average_rating} />
                                        {ratingSummaryText(listing.seller.average_rating, listing.seller.rating_count)}
                                    </span>
                                </p>
                            )}

                            {canBuy && (requestAllowsBuying || listing.seller) && (
                                <div className="id-actions">
                                    {requestAllowsBuying && (
                                        <button
                                            type="button"
                                            className="id-buy"
                                            onClick={() => window.location.assign(meetPageUrl(listing.listing_id, from))}
                                        >
                                            Buy Now
                                        </button>
                                    )}
                                    {listing.seller && (
                                        <button
                                            type="button"
                                            className="id-message-seller"
                                            onClick={() => window.location.assign(messagePageUrl(listing.seller.id, listing.listing_id))}
                                        >
                                            Message Seller
                                        </button>
                                    )}
                                </div>
                            )}

                            {requestCount !== null && (
                                <p className="id-request-count">
                                    <PeopleIcon />
                                    {requestCount === 0
                                        ? <span>No purchase requests yet</span>
                                        : (
                                            <span>
                                                <strong>{requestCount === 1 ? '1 person' : `${requestCount} people`}</strong>
                                                {requestCount === 1 ? ' has requested this item' : ' have requested this item'}
                                            </span>
                                        )}
                                </p>
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
