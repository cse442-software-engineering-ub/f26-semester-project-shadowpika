import React, { useState } from 'react';

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

export default ItemCover;
