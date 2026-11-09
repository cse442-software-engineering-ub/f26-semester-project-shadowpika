import React, { useState } from 'react';
import ItemCover from './ItemCover.jsx';
import './ListingGallery.css';

function listingImageUrls(imageUrls, imageUrl) {
    const urls = Array.isArray(imageUrls) ? imageUrls.filter(url => typeof url === 'string' && url.trim()) : [];
    return urls.length ? urls : (imageUrl ? [imageUrl] : []);
}

function Gallery({ name, urls }) {
    const [selected, setSelected] = useState(0);
    return <div className="listing-gallery">
        <div className="id-cover"><ItemCover key={urls[selected] || 'empty'} name={name} imageUrl={urls[selected]} /></div>
        {urls.length > 1 && <>
            <p className="listing-photo-count" aria-live="polite">Photo {selected + 1} of {urls.length}</p>
            <div className="listing-thumbnails" role="group" aria-label="Listing photos">
                {urls.map((url, index) => <button type="button" key={`${index}:${url}`} aria-label={`View photo ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
                    <img src={url} alt="" />
                </button>)}
            </div>
        </>}
    </div>;
}

export default function ListingGallery({ name, imageUrls, imageUrl }) {
    const urls = listingImageUrls(imageUrls, imageUrl);
    return <Gallery key={JSON.stringify([name, urls])} name={name} urls={urls} />;
}
