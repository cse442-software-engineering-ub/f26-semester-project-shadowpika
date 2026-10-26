import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import ItemCover from './ItemCover.jsx';
import IncomingRequests from './IncomingRequests.jsx';
import RecommendedItems from './RecommendedItems.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import { STATUS_LABELS, cancelMeetingRequest, fetchMyMeetingRequests, formatMeetingDate, formatMeetingTime } from './meetingRequests.js';

// Home page: recommended items, then the logged-in buyer's meeting requests, in the order the server sends them.
function Home() {
    const [requests, setRequests] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');
    const [message, setMessage] = useState(null); // result of the last cancel: { kind, text }
    const [cancellingId, setCancellingId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        fetchMyMeetingRequests()
            .then((data) => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.requests)) {
                    setRequests(data.requests);
                    setStatus('done');
                } else {
                    setError(data.error || 'Unable to load your purchase requests.');
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

    // Only a pending request can be canceled; the server refuses anything else and its error is shown.
    async function handleCancel(listingId) {
        setMessage(null);
        setCancellingId(listingId);
        try {
            const data = await cancelMeetingRequest(listingId);
            if (data.success) {
                setRequests((current) => current.filter((request) => !(request.listing_id === listingId && request.status === 'pending')));
                setMessage({ kind: 'success', text: 'Your meeting request was canceled.' });
            } else {
                setMessage({ kind: 'error', text: data.error || 'Unable to cancel your meeting request.' });
            }
        } catch {
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            setCancellingId(null);
        }
    }

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <h1 className="ps-title">Home</h1>

                <RecommendedItems />

                <section className="mr-requests" aria-labelledby="mr-requests-title">
                    <h2 id="mr-requests-title" className="mr-section-title">My Purchase Requests</h2>

                    {status === 'loading' && <p className="id-message">Loading your purchase requests...</p>}
                    {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}
                    {message && (
                        <p
                            className={`mr-message mr-cancel-message ${message.kind === 'error' ? 'id-error' : 'mr-success'}`}
                            role={message.kind === 'error' ? 'alert' : 'status'}
                        >
                            {message.text}
                        </p>
                    )}
                    {status === 'done' && requests.length === 0 && (
                        <p className="id-message">You have no purchase requests yet.</p>
                    )}

                    {status === 'done' && requests.length > 0 && (
                        <ul className="mr-request-list">
                            {requests.map((request, index) => (
                                <li className="mr-request" key={`${request.listing_id}-${index}`}>
                                    <div className="mr-request-cover">
                                        <ItemCover name={request.name} imageUrl={request.image_url} />
                                    </div>
                                    <div className="mr-request-body">
                                        <h3 className="mr-request-name">{request.name}</h3>
                                        <p className="mr-request-price">${request.price}</p>
                                        <p className="mr-request-when">
                                            {formatMeetingDate(request.meeting_date)}, {formatMeetingTime(request.meeting_time)}
                                        </p>
                                        <p className="mr-request-where">{request.location}</p>
                                        <span className={`mr-status mr-status-${request.status}`}>
                                            {STATUS_LABELS[request.status] ?? request.status}
                                        </span>
                                        {request.status === 'pending' && (
                                            <button
                                                type="button"
                                                className="mr-cancel"
                                                disabled={cancellingId === request.listing_id}
                                                onClick={() => handleCancel(request.listing_id)}
                                            >
                                                Cancel Request
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <IncomingRequests />
            </main>
        </div>
    );
}

export default Home;
