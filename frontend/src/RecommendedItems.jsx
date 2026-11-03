import React, { useEffect, useState } from 'react';
import ItemCover from './ItemCover.jsx';
import './RecommendedItems.css';
import { fetchRecommendedItems } from './recommendedItems.js';
import { itemPageUrl } from './localListings.js';

// Home page row of recommended items, in the order the server sends them.
function RecommendedItems() {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetchRecommendedItems()
            .then((data) => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.items)) {
                    setItems(data.items);
                    setStatus('done');
                } else {
                    setError(data.error || 'Could not load recommended items.');
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
        <section className="ri-section" aria-labelledby="ri-title">
            <h2 id="ri-title" className="mr-section-title">Recommended Items</h2>

            {status === 'loading' && <p className="id-message">Loading recommended items...</p>}
            {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}
            {status === 'done' && items.length === 0 && (
                <p className="id-message">No recommended items right now.</p>
            )}

            {status === 'done' && items.length > 0 && (
                <ul className="ri-row">
                    {items.map((item, index) => (
                        <li key={`${item.listing_id}-${index}`}>
                            <a className="ri-card" href={itemPageUrl(item.listing_id)}>
                                <div className="ri-cover">
                                    <ItemCover name={item.name} imageUrl={item.image_url} />
                                </div>
                                <span className="ri-name">{item.name}</span>
                                <span className="ri-price">${item.price}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default RecommendedItems;
