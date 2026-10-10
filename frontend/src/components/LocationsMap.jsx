import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// UB North Campus, used until there are pins to frame.
const CAMPUS_CENTER = [43.0008, -78.789];
const CAMPUS_ZOOM = 16;

// Teardrop pin from the Check-in Map design; colors come from settings.css per state.
const PIN_SVG =
    '<svg viewBox="0 0 28 38" width="28" height="38" aria-hidden="true">' +
    '<path class="kv-pin__body" d="M14 1C6.8 1 1 6.7 1 13.8 1 23.5 14 37 14 37s13-13.5 13-23.2C27 6.7 21.2 1 14 1z"/>' +
    '<circle class="kv-pin__dot" cx="14" cy="14" r="5"/>' +
    '</svg>';

const pinIcon = (state) =>
    L.divIcon({
        className: `kv-pin kv-pin--${state}`,
        html: PIN_SVG,
        iconSize: [28, 38],
        iconAnchor: [14, 37],
        tooltipAnchor: [0, -36],
    });

const LABEL_OPTIONS = { permanent: true, direction: 'top', className: 'kv-pin-label' };

/** Leaflet map of approved meeting locations, styled after the Check-in Map frames. */
export default function LocationsMap({ locations, removingIds, selectedId, draft, onMapClick, onSelect }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const pinsRef = useRef(null);
    const framedRef = useRef(false);
    const handlersRef = useRef({ onMapClick, onSelect });

    useEffect(() => {
        handlersRef.current = { onMapClick, onSelect };
    });

    useEffect(() => {
        const map = L.map(containerRef.current, { center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        map.on('click', (event) => handlersRef.current.onMapClick(event.latlng));
        pinsRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
            framedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const pins = pinsRef.current;
        if (!pins) return;
        pins.clearLayers();

        for (const location of locations) {
            const removing = removingIds.has(location.location_id);
            const selected = location.location_id === selectedId;
            const state = removing ? 'removing' : selected ? 'selected' : 'saved';
            if (selected) {
                L.circle([location.lat, location.lng], {
                    radius: 45,
                    color: removing ? '#9aa5b4' : '#24364f',
                    weight: 1,
                    fillColor: removing ? '#9aa5b4' : '#3f6fa0',
                    fillOpacity: 0.12,
                    interactive: false,
                }).addTo(pins);
            }
            L.marker([location.lat, location.lng], { icon: pinIcon(state), title: location.label, riseOnHover: true })
                .bindTooltip(removing ? `${location.label} (will be removed)` : location.label, LABEL_OPTIONS)
                .on('click', (event) => {
                    L.DomEvent.stop(event);
                    handlersRef.current.onSelect(location.location_id);
                })
                .addTo(pins);
        }

        if (draft) {
            L.marker([draft.lat, draft.lng], { icon: pinIcon('draft'), interactive: false })
                .bindTooltip(draft.label?.trim() || 'New location', LABEL_OPTIONS)
                .addTo(pins);
        }

        // Frame the saved pins once, when they first arrive, so later clicks don't move the map.
        if (!framedRef.current && locations.length > 0) {
            framedRef.current = true;
            const bounds = L.latLngBounds(locations.map((location) => [location.lat, location.lng]));
            mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
        }
    }, [locations, removingIds, selectedId, draft]);

    return (
        <div
            ref={containerRef}
            className="kv-locations-map"
            data-testid="locations-map"
            role="application"
            aria-label="Approved meeting locations map. Click to mark a new location; click a pin to select it."
        />
    );
}
