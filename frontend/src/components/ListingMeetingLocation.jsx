import { useMemo, useState } from 'react';
import LocationsMap from './LocationsMap.jsx';

const validLocation = (location) => (
    location
    && typeof location.label === 'string'
    && location.label.trim() !== ''
    && Number.isFinite(location.lat)
    && location.lat >= -90 && location.lat <= 90
    && Number.isFinite(location.lng)
    && location.lng >= -180 && location.lng <= 180
);

function SelectedLocationMap({ location }) {
    const locations = useMemo(() => [location], [location]);
    const [mapError, setMapError] = useState(false);

    return (
        <>
            <LocationsMap locations={locations} readOnly onMapError={setMapError} />
            {mapError && (
                <p className="id-error" role="status">
                    The map could not load. The seller's meeting location is shown above.
                </p>
            )}
        </>
    );
}

export default function ListingMeetingLocation({ listing }) {
    const location = listing.meeting_location_details;
    const canMap = validLocation(location);
    const legacyLabel = typeof listing.meeting_location === 'string' ? listing.meeting_location.trim() : '';
    const label = typeof location?.label === 'string' ? location.label.trim() || legacyLabel : legacyLabel;

    return (
        <section className="id-meeting-location" aria-labelledby="id-meeting-location-title">
            <h2 id="id-meeting-location-title">Meeting Location</h2>
            <p className="id-location-name">
                {label || 'The seller has not provided a meeting location.'}
            </p>
            {canMap ? (
                <SelectedLocationMap
                    key={JSON.stringify([listing.listing_id, location.location_id, location.lat, location.lng, location.label])}
                    location={location}
                />
            ) : (
                <p className="id-muted">Map unavailable for this meeting location.</p>
            )}
        </section>
    );
}
