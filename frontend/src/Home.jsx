import React, { useState } from 'react';
import NavBar from './NavBar.jsx';
import ItemCover from './ItemCover.jsx';
import IncomingRequests from './IncomingRequests.jsx';
import RecommendedItems from './RecommendedItems.jsx';
import MeetingProgress from './MeetingProgress.jsx';
import useMeetingList from './useMeetingList.js';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import { STATUS_LABELS, cancelMeetingRequest, fetchMyMeetingRequests, formatMeetingDate, formatMeetingTime, requestItemUrl } from './meetingRequests.js';

// Home page: recommended items, then the logged-in buyer's meeting requests, in the order the server sends them.
function Home() {
    const { requests, setRequests, status, error, startMutation, finishMutation, refresh } =
        useMeetingList(fetchMyMeetingRequests, 'Unable to load your purchase requests.');
    const [message, setMessage] = useState(null); // result of the last cancel: { kind, text }
    const [cancellingId, setCancellingId] = useState(null);

    // Only a pending request can be canceled; the server refuses anything else and its error is shown.
    async function handleCancel(listingId) {
        if (!startMutation()) return;
        let reload = false;
        setMessage(null);
        setCancellingId(listingId);
        try {
            const data = await cancelMeetingRequest(listingId);
            if (data.success) {
                setRequests((current) => current.filter((request) => !(request.listing_id === listingId && request.status === 'pending')));
                setMessage({ kind: 'success', text: 'Your meeting request was canceled.' });
            } else {
                reload = true;
                setMessage({ kind: 'error', text: data.error || 'Unable to cancel your meeting request.' });
            }
        } catch {
            reload = true;
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            finishMutation();
            if (reload) refresh();
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
                    {error && <p className="id-message id-error" role="alert">{error} <button type="button" className="mr-cancel" onClick={refresh}>Reload purchase requests</button></p>}
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
                                        <a className="mr-request-link" href={requestItemUrl(request.listing_id)}>
                                            <ItemCover name={request.name} imageUrl={request.image_url} />
                                        </a>
                                    </div>
                                    <div className="mr-request-body">
                                        <h3 className="mr-request-name"><a className="mr-request-link" href={requestItemUrl(request.listing_id)}>{request.name}</a></h3>
                                        <p className="mr-request-price">${request.price}</p>
                                        <p className="mr-request-when">
                                            {formatMeetingDate(request.meeting_date)}, {formatMeetingTime(request.meeting_time)}
                                        </p>
                                        <p className="mr-request-where">{request.location}</p>
                                        <span className={`mr-status mr-status-${request.status}`}>
                                            {STATUS_LABELS[request.status] ?? request.status}
                                        </span>
                                        <MeetingProgress request={request} />
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
                                        {request.status === 'approved' && !request.checked_in_at && Number.isInteger(request.request_id) && request.request_id > 0 && (
                                            <a className="mr-cancel" href={`./check-in.html?request_id=${encodeURIComponent(request.request_id)}`}>Check In</a>
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
