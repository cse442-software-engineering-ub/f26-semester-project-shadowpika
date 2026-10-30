import React, { useState } from 'react';
import ItemCover from './ItemCover.jsx';
import MeetingProgress from './MeetingProgress.jsx';
import useMeetingList from './useMeetingList.js';
import { canCheckIn, canMarkSold, updateListing } from './listingSales.js';
import { fetchMeetingLocations } from './api.js';
import { STATUS_LABELS, fetchIncomingMeetingRequests, formatMeetingDate, formatMeetingTime, requestItemUrl, respondMeetingRequest } from './meetingRequests.js';

const SUCCESS_TEXT = {
    approve: 'You approved the meeting request.',
    deny: 'You denied the meeting request.',
    change_location: 'You requested a different meeting location.',
};

// Home page: meeting requests other students made on the logged-in user's items, in the order the server sends them.
function IncomingRequests() {
    const { requests, setRequests, status, error, startMutation, finishMutation, refresh } =
        useMeetingList(fetchIncomingMeetingRequests, 'Unable to load requests for your items.');
    const [message, setMessage] = useState(null); // result of the last action: { kind, text }
    const [busy, setBusy] = useState(false);
    const [picker, setPicker] = useState(null); // { requestId, locations, choice } while a Change Location picker is open

    // Only a pending request can be answered; the server refuses anything else and its error is shown.
    async function respond(request, action, locationId) {
        if (request.status !== 'pending' || !startMutation()) return;
        let reload = false;
        setMessage(null);
        setBusy(true);
        try {
            const data = await respondMeetingRequest(request.request_id, action, locationId);
            if (data.success) {
                setRequests((current) => current.map((item) => (item.request_id === request.request_id ? data.request : item)));
                setPicker(null);
                setMessage({ kind: 'success', text: SUCCESS_TEXT[action] });
            } else {
                reload = true;
                setPicker(null);
                setMessage({ kind: 'error', text: data.error || 'Unable to answer the meeting request.' });
            }
        } catch {
            reload = true;
            setPicker(null);
            setMessage({ kind: 'error', text: 'Could not connect to the server.' });
        } finally {
            finishMutation();
            if (reload) refresh();
            setBusy(false);
        }
    }

    async function markSold(request) {
        if (!canMarkSold(request) || !startMutation()) return;
        setBusy(true);
        setMessage(null);
        try {
            await updateListing({ action: 'update_status', listing_id: request.listing_id,
                status: 'sold', request_id: request.request_id });
            // A listing can have several requests; none should offer a new arrival or sale.
            setRequests((current) => current.map((item) => item.listing_id === request.listing_id
                ? { ...item, listing_status: 'sold', can_mark_sold: false } : item));
            setMessage({ kind: 'success', text: 'Listing marked as sold.' });
        } catch (failure) {
            setMessage({ kind: 'error', text: failure instanceof TypeError
                ? 'Could not connect to the server. Reload to check the listing status.'
                : failure.message || 'Unable to mark the listing as sold.' });
        } finally {
            finishMutation();
            await refresh();
            setBusy(false);
        }
    }

    // The picker offers the community's approved locations except the one the request already uses.
    async function openPicker(request) {
        if (request.status !== 'pending' || !startMutation()) return;
        setMessage(null);
        setBusy(true);
        try {
            const data = await fetchMeetingLocations(request.community);
            if (data.success && Array.isArray(data.locations)) {
                const others = data.locations.filter((location) => location.label !== request.location);
                setPicker({ requestId: request.request_id, locations: others, choice: '' });
            } else {
                setMessage({ kind: 'error', text: data.error || 'The meeting locations could not be loaded.' });
            }
        } catch {
            setMessage({ kind: 'error', text: 'The meeting locations could not be loaded.' });
        } finally {
            finishMutation();
            await refresh();
            setBusy(false);
        }
    }

    function sendNewLocation(request) {
        if (request.status !== 'pending' || !picker) return;
        if (!picker.choice) {
            setMessage({ kind: 'error', text: 'Select a different meeting location.' });
            return;
        }
        respond(request, 'change_location', picker.choice);
    }

    function cancelPicker() {
        setMessage(null);
        setPicker(null);
    }

    return (
        <section className="mr-requests" aria-labelledby="mr-incoming-title">
            <h2 id="mr-incoming-title" className="mr-section-title">Requests for My Items</h2>

            {status === 'loading' && <p className="id-message">Loading requests for your items...</p>}
            {error && <p className="id-message id-error" role="alert">{error} <button type="button" className="mr-cancel" onClick={refresh}>Reload incoming requests</button></p>}
            {message && (
                <p
                    className={`mr-message mr-cancel-message ${message.kind === 'error' ? 'id-error' : 'mr-success'}`}
                    role={message.kind === 'error' ? 'alert' : 'status'}
                >
                    {message.text}
                </p>
            )}
            {status === 'done' && requests.length === 0 && (
                <p className="id-message">No one has requested your items yet.</p>
            )}

            {status === 'done' && requests.length > 0 && (
                <ul className="mr-request-list">
                    {requests.map((request) => {
                        const pickerOpen = request.status === 'pending' && picker?.requestId === request.request_id;
                        return (
                            <li className="mr-request" key={request.request_id}>
                                <div className="mr-request-cover">
                                    <a className="mr-request-link" href={requestItemUrl(request.listing_id)}>
                                        <ItemCover name={request.name} imageUrl={request.image_url} />
                                    </a>
                                </div>
                                <div className="mr-request-body">
                                    <h3 className="mr-request-name"><a className="mr-request-link" href={requestItemUrl(request.listing_id)}>{request.name}</a></h3>
                                    <p className="mr-request-price">${request.price}</p>
                                    <p className="mr-request-buyer">Requested by {request.buyer}</p>
                                    <p className="mr-request-when">
                                        {formatMeetingDate(request.meeting_date)}, {formatMeetingTime(request.meeting_time)}
                                    </p>
                                    <p className="mr-request-where">{request.location}</p>
                                    <span className={`mr-status mr-status-${request.status}`}>
                                        {STATUS_LABELS[request.status] ?? request.status}
                                    </span>
                                    <MeetingProgress request={request} seller />
                                    {request.status === 'approved' && (
                                        <div className="mr-actions">
                                            {canCheckIn(request, true) && <a className="mr-cancel"
                                                href={`./check-in.html?request_id=${encodeURIComponent(request.request_id)}`}>Check In</a>}
                                            {canMarkSold(request) && <button type="button" className="mr-cancel"
                                                disabled={busy} onClick={() => markSold(request)}>Mark as sold</button>}
                                        </div>
                                    )}
                                    {request.status === 'pending' && !pickerOpen && (
                                        <div className="mr-actions">
                                            <button type="button" className="mr-cancel" disabled={busy} onClick={() => respond(request, 'approve')}>Approve</button>
                                            <button type="button" className="mr-cancel" disabled={busy} onClick={() => respond(request, 'deny')}>Deny</button>
                                            <button type="button" className="mr-cancel" disabled={busy} onClick={() => openPicker(request)}>Change Location</button>
                                        </div>
                                    )}
                                    {pickerOpen && (
                                        <div className="mr-picker">
                                            <label className="mr-field">
                                                New meeting location
                                                <select value={picker.choice} onChange={(event) => setPicker({ ...picker, choice: event.target.value })}>
                                                    <option value="">Select a location</option>
                                                    {picker.locations.map((location) => (
                                                        <option key={location.location_id} value={location.location_id}>{location.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <div className="mr-actions">
                                                <button type="button" className="mr-cancel" disabled={busy} onClick={() => sendNewLocation(request)}>Send New Location</button>
                                                <button type="button" className="mr-cancel" disabled={busy} onClick={cancelPicker}>Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

export default IncomingRequests;
