import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import ItemCover from './ItemCover.jsx';
import IncomingRequests from './IncomingRequests.jsx';
import RecommendedItems from './RecommendedItems.jsx';
import PreviouslyViewed from './PreviouslyViewed.jsx';
import MeetingProgress from './MeetingProgress.jsx';
import useMeetingList from './useMeetingList.js';
import { canCheckIn } from './listingSales.js';
import { sellerPageUrl } from './ratings.js';
import ActionConfirmationDialog from './components/ActionConfirmationDialog.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import { STATUS_LABELS, acceptLocationChange, cancelMeetingRequest, denyLocationChange, fetchMyMeetingRequests, formatMeetingDate, formatMeetingTime, removeDeniedRequest, requestItemUrl } from './meetingRequests.js';

// Home page: recommended items, previously viewed items, then the logged-in buyer's meeting requests, in the order the server sends them.
function Home() {
    const { requests, setRequests, status, error, startMutation, finishMutation, refresh } =
        useMeetingList(fetchMyMeetingRequests, 'Unable to load your purchase requests.');
    // Result of the last action: { kind, text }. Starts as the "request sent" notice when Organize a Meet sent the buyer here.
    const [message, setMessage] = useState(() => (
        new URLSearchParams(window.location.search).get('request_sent') === '1'
            ? { kind: 'success', text: 'Your meeting request was sent.' }
            : null
    ));
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelConfirmation, setCancelConfirmation] = useState(null);
    const headingRef = React.useRef(null);
    const [acceptingId, setAcceptingId] = useState(null);
    const [denyingId, setDenyingId] = useState(null);
    const [removingId, setRemovingId] = useState(null);

    // Drop the notice flag from the address so a reload does not show it again.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has('request_sent')) return;
        params.delete('request_sent');
        const query = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
    }, []);

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

    // Only a request with a proposed new location can be accepted; the server's answer replaces that request.
    async function handleAccept(request) {
        if (!startMutation()) return;
        let reload = false;
        setMessage(null);
        setAcceptingId(request.request_id);
        try {
            const data = await acceptLocationChange(request.request_id);
            if (data.success) {
                setRequests((current) => current.map((item) => (item.request_id === request.request_id ? data.request : item)));
                setMessage({ kind: 'success', text: 'You accepted the new meeting location.' });
            } else {
                reload = true;
                setMessage({ kind: 'error', text: data.error || 'Unable to accept the new meeting location.' });
            }
        } catch {
            reload = true;
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            finishMutation();
            if (reload) refresh();
            setAcceptingId(null);
        }
    }

    // Denying keeps the original location; the server's answer (back to pending) replaces that request.
    async function handleDeny(request) {
        if (!startMutation()) return;
        let reload = false;
        setMessage(null);
        setDenyingId(request.request_id);
        try {
            const data = await denyLocationChange(request.request_id);
            if (data.success) {
                setRequests((current) => current.map((item) => (item.request_id === request.request_id ? data.request : item)));
                setMessage({ kind: 'success', text: 'You denied the new meeting location.' });
            } else {
                reload = true;
                setMessage({ kind: 'error', text: data.error || 'Unable to deny the new meeting location.' });
            }
        } catch {
            reload = true;
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            finishMutation();
            if (reload) refresh();
            setDenyingId(null);
        }
    }

    // Only a denied request can be removed; the server refuses anything else and its error is shown.
    async function handleRemove(request) {
        if (!startMutation()) return;
        let reload = false;
        setMessage(null);
        setRemovingId(request.request_id);
        try {
            const data = await removeDeniedRequest(request.request_id);
            if (data.success) {
                setRequests((current) => current.filter((item) => item.request_id !== request.request_id));
                setMessage({ kind: 'success', text: 'The denied request was removed.' });
            } else {
                reload = true;
                setMessage({ kind: 'error', text: data.error || 'Unable to remove the denied request.' });
            }
        } catch {
            reload = true;
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            finishMutation();
            if (reload) refresh();
            setRemovingId(null);
        }
    }

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <h1 ref={headingRef} tabIndex={-1} className="ps-title">Home</h1>

                <RecommendedItems />

                <PreviouslyViewed />

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
                                        <p className="mr-request-price">${request.offer_price ?? request.price}</p>
                                        {request.offer_price != null && (
                                            <p className="mr-request-offer">Price changed through an offer (listed at ${request.price})</p>
                                        )}
                                        <p className="mr-request-when">
                                            {formatMeetingDate(request.meeting_date)}, {formatMeetingTime(request.meeting_time)}
                                        </p>
                                        <p className="mr-request-where">{request.location}</p>
                                        <span className={`mr-status mr-status-${request.status}`}>
                                            {STATUS_LABELS[request.status] ?? request.status}
                                        </span>
                                        <MeetingProgress request={request} />
                                        {request.status === 'approved' && request.both_checked_in && request.seller_id && (
                                            <a className="mr-rate-seller" href={sellerPageUrl(request.seller_id)}>Rate Seller</a>
                                        )}
                                        {request.status === 'pending' && (
                                            <button
                                                type="button"
                                                className="mr-cancel"
                                                disabled={cancellingId === request.listing_id}
                                                onClick={(event) => setCancelConfirmation({ request, trigger: event.currentTarget })}
                                            >
                                                Cancel Request
                                            </button>
                                        )}
                                        {request.status === 'denied' && (
                                            <button
                                                type="button"
                                                className="mr-cancel"
                                                disabled={removingId === request.request_id}
                                                onClick={() => handleRemove(request)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                        {request.status === 'location_change_requested' && (
                                            <button
                                                type="button"
                                                className="mr-cancel"
                                                disabled={acceptingId === request.request_id || denyingId === request.request_id}
                                                onClick={() => handleAccept(request)}
                                            >
                                                Accept New Location
                                            </button>
                                        )}
                                        {request.status === 'location_change_requested' && (
                                            <button
                                                type="button"
                                                className="mr-cancel"
                                                disabled={acceptingId === request.request_id || denyingId === request.request_id}
                                                onClick={() => handleDeny(request)}
                                            >
                                                Deny New Location
                                            </button>
                                        )}
                                        {canCheckIn(request) && (
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
            {cancelConfirmation && <ActionConfirmationDialog title="Cancel this meeting request?"
                confirmLabel="Cancel Request" cancelLabel="Keep Request" busy={cancellingId !== null}
                trigger={cancelConfirmation.trigger} fallbackRef={headingRef}
                onDismiss={() => { if (cancellingId === null) setCancelConfirmation(null); }}
                onConfirm={async () => {
                    const current = requests.find((request) => request.request_id === cancelConfirmation.request.request_id
                        && request.listing_id === cancelConfirmation.request.listing_id);
                    if (!current || current.status !== 'pending') {
                        setMessage({ kind: 'error', text: 'This request is no longer pending. Reload to check its status.' });
                    } else await handleCancel(current.listing_id);
                    setCancelConfirmation(null);
                }}>
                <p><strong>{cancelConfirmation.request.name}</strong></p>
                <p>{formatMeetingDate(cancelConfirmation.request.meeting_date)}, {formatMeetingTime(cancelConfirmation.request.meeting_time)} — {cancelConfirmation.request.location}</p>
                <p>The meeting request will be canceled. The listing will remain available.</p>
            </ActionConfirmationDialog>}
        </div>
    );
}

export default Home;
