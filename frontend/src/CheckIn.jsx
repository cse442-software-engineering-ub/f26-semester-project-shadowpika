import { useMemo, useState } from 'react';
import NavBar from './NavBar.jsx';
import LocationsMap from './components/LocationsMap.jsx';
import { formatMeetingDate, formatMeetingTime } from './meetingRequests.js';
import { validLocation, windowMessage } from './checkin.js';
import useCheckin from './useCheckin.js';
import './ProductSearch.css';
import './ItemDetails.css';
import './CheckIn.css';

export default function CheckIn() {
    const requestId = new URLSearchParams(window.location.search).get('request_id') || '';
    const { meeting, loading, busy, allowed, error, geoMessage, state, allow, submit, refresh } = useCheckin(requestId);
    const [mapError, setMapError] = useState(false);
    const location = meeting?.location;
    const locations = useMemo(() => validLocation(location) ? [location] : [], [location]);
    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame id-frame ci-frame">
                <a className="ci-back" href="./home.html">Back to Home</a>
                <h1 className="ps-title">Meeting location</h1>
                {loading && <p role="status">Loading meeting...</p>}
                {error && <div className="id-error" role="alert"><p>{error}</p><button type="button" onClick={refresh} disabled={loading || busy}>Reload meeting</button></div>}
                {meeting && <>
                    <section className="ci-details" aria-label="Meeting details">
                        <h2>{meeting.name}</h2>
                        <p>${meeting.price}</p>
                        <p>{formatMeetingDate(meeting.meeting_date)}, {formatMeetingTime(meeting.meeting_time)}</p>
                        <p>{meeting.location_label}</p>
                    </section>
                    {locations.length > 0 && <LocationsMap locations={locations} selectedId={meeting.location.location_id}
                        readOnly circleRadius={100} fitCircle onMapError={setMapError} />}
                    {mapError && <p role="status">The map could not load. The agreed meeting location is shown above.</p>}
                    <section className="ci-actions" aria-label="Check in">
                        <p role="status">{windowMessage(meeting, state)}</p>
                        {!meeting.checked_in_at && <>
                            <p role="status">{geoMessage}</p>
                            <div className="ci-buttons">
                                <button type="button" onClick={allow} disabled={busy || loading}>Allow location</button>
                                <button type="button" className="ci-submit" disabled={!allowed} onClick={submit}>
                                    {busy ? 'Checking in...' : "I'm here"}
                                </button>
                            </div>
                        </>}
                    </section>
                </>}
            </main>
        </div>
    );
}
