import React, { useEffect, useState } from 'react';
import NavBar from './NavBar.jsx';
import ItemCover from './ItemCover.jsx';
import './ProductSearch.css';
import './ItemDetails.css';
import './MeetingRequests.css';
import { STATUS_LABELS, fetchMyMeetingRequests, formatMeetingDate, formatMeetingTime } from './meetingRequests.js';

// Home page: the logged-in buyer's meeting requests, in the order the server sends them.
function Home() {
    const [requests, setRequests] = useState([]);
    const [status, setStatus] = useState('loading'); // loading | done | error
    const [error, setError] = useState('');

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

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame">
                <h1 className="ps-title">Home</h1>

                <section className="mr-requests" aria-labelledby="mr-requests-title">
                    <h2 id="mr-requests-title" className="mr-section-title">My Purchase Requests</h2>

                    {status === 'loading' && <p className="id-message">Loading your purchase requests...</p>}
                    {status === 'error' && <p className="id-message id-error" role="alert">{error}</p>}
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
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}

export default Home;
