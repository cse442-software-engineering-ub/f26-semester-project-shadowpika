import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import ItemCover from './ItemCover.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import { createMeetingRequest, itemPageFrom, itemUrlFrom, loadListing, meetingRequestError } from './meetingRequests.js';

const CONNECTION_ERROR = 'Could not connect to the server.';
const LOCATION_UNAVAILABLE = "The seller's meeting location is unavailable. Return to the item and try again.";

// Buy Now uses the seller's saved location. Buyers choose only the date and time.
function OrganizeMeet() {
    const [listingId] = useState(() => new URLSearchParams(window.location.search).get('listing_id') ?? '');
    const [listing, setListing] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [loadError, setLoadError] = useState('');

    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [message, setMessage] = useState(null); // { kind: 'success' | 'error', text }
    const [sending, setSending] = useState(false);
    const locationId = listing?.meeting_location_id;
    const locationLabel = typeof listing?.meeting_location === 'string' ? listing.meeting_location.trim() : '';
    const hasLocation = Number.isInteger(locationId) && locationId > 0 && locationLabel !== '';

    useEffect(() => {
        let cancelled = false;

        loadListing(listingId)
            .then((data) => {
                if (cancelled) return;
                if (data.success && data.listing) {
                    setListing(data.listing);
                    setStatus('done');
                } else {
                    setLoadError(data.error || 'This item could not be loaded.');
                    setStatus('error');
                }
            })
            .catch(() => {
                if (cancelled) return;
                setLoadError(CONNECTION_ERROR);
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [listingId]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (sending || !hasLocation) return;
        const error = meetingRequestError({ date, time, locationId });
        if (error) {
            setMessage({ kind: 'error', text: error });
            return;
        }

        setSending(true);
        setMessage(null);
        createMeetingRequest({ listingId, date, time, locationId })
            .then((data) => {
                setMessage(data.success
                    ? { kind: 'success', text: 'Your meeting request was sent.' }
                    : { kind: 'error', text: data.error || 'Your meeting request could not be sent.' });
            })
            .catch(() => setMessage({ kind: 'error', text: CONNECTION_ERROR }))
            .finally(() => setSending(false));
    };

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <a className="id-back" href={itemUrlFrom(listingId, itemPageFrom(window.location.search))}>
                    <span aria-hidden="true">←</span> Back to item
                </a>
                <h1 className="ps-title mr-title">Organize a Meet</h1>

                {status === 'loading' && <p className="id-message">Loading item details...</p>}
                {status === 'error' && <p className="id-message id-error" role="alert">{loadError}</p>}

                {status === 'done' && listing && (
                    <section className="mr-meet">
                        <div className="mr-item">
                            <div className="mr-item-cover">
                                <ItemCover name={listing.name} imageUrl={listing.image_url} />
                            </div>
                            <div>
                                <h2 className="mr-item-name">{listing.name}</h2>
                                <p className="mr-item-price">${listing.price}</p>
                            </div>
                        </div>

                        <form className="mr-form" onSubmit={handleSubmit} noValidate>
                            <label className="mr-field">
                                <span>Date</span>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </label>
                            <label className="mr-field">
                                <span>Preferred Time</span>
                                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                            </label>
                            <label className="mr-field">
                                <span>Meeting Location</span>
                                <input type="text" value={locationLabel} readOnly aria-describedby="mr-location-note" />
                            </label>
                            <p id="mr-location-note">Set by the seller. This meeting location cannot be changed.</p>
                            {!hasLocation && <p className="mr-message id-error" role="alert">{LOCATION_UNAVAILABLE}</p>}

                            {message && (
                                <p
                                    className={`mr-message ${message.kind === 'error' ? 'id-error' : 'mr-success'}`}
                                    role={message.kind === 'error' ? 'alert' : 'status'}
                                >
                                    {message.text}
                                </p>
                            )}

                            <button type="submit" className="mr-submit" disabled={sending || !hasLocation}>
                                Confirm Meeting Request
                            </button>
                        </form>
                    </section>
                )}
            </main>
        </div>
    );
}

export default OrganizeMeet;
