import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './Favorites.css';
import ItemCover from './ItemCover.jsx';
import HeartIcon from './HeartIcon.jsx';
import { fetchFavorites, removeFavorite } from './favorites.js';
import { itemPageUrl } from './localListings.js';

function Favorites() {
    const [favorites, setFavorites] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');
    const [removeMessage, setRemoveMessage] = useState('');
    const [removeError, setRemoveError] = useState('');
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetchFavorites()
            .then((data) => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.favorites)) {
                    setFavorites(data.favorites);
                    setStatus('done');
                } else {
                    setError(data.error || 'Could not load your saved items.');
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

    const handleRemove = async (listingId) => {
        if (removing) return;
        setRemoveMessage('');
        setRemoveError('');
        setRemoving(true);
        try {
            const data = await removeFavorite(listingId);
            if (data.success === true) {
                setFavorites((current) => current.filter((item) => item.listing_id !== listingId));
                setRemoveMessage('Removed from your favorites.');
            } else {
                setRemoveError(data.error || 'Could not remove this item.');
            }
        } catch {
            setRemoveError('Could not connect to the server.');
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame fav-frame">
                <h1 className="fav-title">Favorites</h1>

                {removeMessage && <p className="ps-results-message">{removeMessage}</p>}
                {removeError && <p className="ps-results-message ps-results-error" role="alert">{removeError}</p>}
                {status === 'loading' && <p className="ps-results-message">Loading your saved items...</p>}
                {status === 'error' && <p className="ps-results-message ps-results-error" role="alert">{error}</p>}
                {status === 'done' && favorites.length === 0 && (
                    <p className="ps-results-message">You have no saved items yet.</p>
                )}

                {status === 'done' && favorites.length > 0 && (
                    <div className="ps-book-grid">
                        {favorites.map((item) => (
                            <article className="ps-book-card" key={item.listing_id}>
                                <button
                                    type="button"
                                    className="fav-heart"
                                    aria-label="Remove from Favorites"
                                    title="Remove from Favorites"
                                    onClick={() => handleRemove(item.listing_id)}
                                >
                                    <HeartIcon filled />
                                </button>
                                <div className="ps-book-cover">
                                    <ItemCover name={item.name} imageUrl={item.image_url} />
                                </div>
                                <div className="ps-book-body">
                                    <h3 className="ps-book-name" title={item.name}>
                                        <a className="ps-book-link" href={itemPageUrl(item.listing_id)}>{item.name}</a>
                                    </h3>
                                    <div className="ps-book-meta">
                                        <span className="ps-book-price">${item.price}</span>
                                        <span className="ps-book-condition">{item.condition}</span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default Favorites;
