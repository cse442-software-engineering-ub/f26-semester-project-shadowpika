import React from 'react';
import './Stars.css';

// Read-only row of five stars; half stars round to the nearest whole star.
export default function Stars({ value, className = '' }) {
    const filled = Math.round(Number(value) || 0);
    return (
        <span className={`kv-stars ${className}`.trim()} role="img" aria-label={value ? `${Number(value).toFixed(1)} out of 5 stars` : 'No ratings yet'}>
            {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} aria-hidden="true" className={star <= filled ? 'kv-star is-filled' : 'kv-star'}>★</span>
            ))}
        </span>
    );
}
