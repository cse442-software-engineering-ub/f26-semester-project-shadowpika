import React, { useCallback, useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import './ProductSearch.css';
import './SellerProfile.css';
import Stars from './components/Stars.jsx';
import { REVIEW_MAX_LENGTH, fetchSellerRatings, ratingSummaryText, submitRating } from './ratings.js';

const reviewDate = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function formatReviewDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : reviewDate.format(date);
}

function RatingForm({ sellerId, sellerName, myRating, onSaved }) {
    const [stars, setStars] = useState(myRating?.rating ?? 0);
    const [review, setReview] = useState(myRating?.review ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        setNotice('');
        if (stars < 1) {
            setError('Choose from 1 to 5 stars.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const data = await submitRating(sellerId, stars, review.trim());
            if (data.success) {
                setNotice(data.message);
                onSaved();
            } else {
                setError(data.error || 'Your rating could not be saved.');
            }
        } catch {
            setError('Could not connect to the server. Your rating was not saved.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="sp-form" onSubmit={handleSubmit} noValidate>
            <h2 className="sp-section-title">{myRating ? 'Update your rating' : `Rate ${sellerName}`}</h2>
            <fieldset className="sp-stars-input" disabled={saving}>
                <legend>Your rating</legend>
                {[1, 2, 3, 4, 5].map((value) => (
                    <label key={value} className={value <= stars ? 'is-filled' : ''}>
                        <input
                            type="radio"
                            name="rating"
                            value={value}
                            checked={stars === value}
                            onChange={() => {
                                setStars(value);
                                setError('');
                            }}
                            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                        />
                        <span aria-hidden="true">★</span>
                    </label>
                ))}
                <span className="sp-star-hint">{STAR_LABELS[stars] || 'Choose a rating'}</span>
            </fieldset>
            <label className="sp-review-label" htmlFor="sp-review">Review (optional)</label>
            <textarea
                id="sp-review"
                className="sp-review"
                rows={4}
                maxLength={REVIEW_MAX_LENGTH}
                value={review}
                disabled={saving}
                onChange={(event) => setReview(event.target.value)}
            />
            <p className="sp-count">{review.length}/{REVIEW_MAX_LENGTH}</p>
            <button type="submit" className="sp-submit" disabled={saving}>
                {saving ? 'Saving...' : myRating ? 'Update Rating' : 'Submit Rating'}
            </button>
            {error && <p className="sp-error" role="alert">{error}</p>}
            {notice && <p className="sp-success" role="status">{notice}</p>}
        </form>
    );
}

export default function SellerProfile() {
    const sellerId = new URLSearchParams(window.location.search).get('seller_id') ?? '';
    const [data, setData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');

    const load = useCallback(() => fetchSellerRatings(sellerId)
        .then((body) => {
            if (body.success) {
                setData(body);
                setStatus('done');
                document.title = `Karavan - ${body.seller_name}`;
            } else {
                setError(body.error || 'This seller could not be loaded.');
                setStatus('error');
            }
        })
        .catch(() => {
            setError('Could not connect to the server.');
            setStatus('error');
        }), [sellerId]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame sp-frame">
                {status === 'loading' && <p className="sp-note">Loading seller...</p>}
                {status === 'error' && <p className="sp-error" role="alert">{error}</p>}
                {status === 'done' && data && (
                    <>
                        <section className="sp-card" aria-labelledby="sp-name">
                            <div className="sp-avatar" aria-hidden="true">{data.seller_name.charAt(0).toUpperCase()}</div>
                            <div>
                                <p className="sp-eyebrow">Seller</p>
                                <h1 id="sp-name" className="sp-name">{data.seller_name}</h1>
                                <p className="sp-summary">
                                    <Stars value={data.averageRating} />
                                    <span className="sp-summary-text">{ratingSummaryText(data.averageRating, data.ratingCount)}</span>
                                </p>
                            </div>
                        </section>

                        {data.can_rate && (
                            <RatingForm
                                sellerId={data.seller_id}
                                sellerName={data.seller_name}
                                myRating={data.my_rating}
                                onSaved={load}
                            />
                        )}
                        {!data.can_rate && !data.is_seller && (
                            <p className="sp-note sp-rate-note">You can rate {data.seller_name} after you complete a purchase with them.</p>
                        )}

                        <section className="sp-reviews" aria-labelledby="sp-reviews-title">
                            <h2 id="sp-reviews-title" className="sp-section-title">Reviews</h2>
                            {data.ratings.length === 0
                                ? <p className="sp-note">{data.seller_name} has no reviews yet.</p>
                                : (
                                    <ul className="sp-review-list">
                                        {data.ratings.map((rating) => (
                                            <li key={`${rating.reviewer_name}-${rating.created_at}`} className="sp-review-item">
                                                <div className="sp-review-head">
                                                    <strong>{rating.reviewer_name}</strong>
                                                    <Stars value={rating.rating} />
                                                    <time dateTime={rating.created_at}>{formatReviewDate(rating.created_at)}</time>
                                                </div>
                                                {rating.review
                                                    ? <p className="sp-review-text">{rating.review}</p>
                                                    : <p className="sp-review-text sp-muted">No written review.</p>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
