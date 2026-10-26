import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationsMap.css';

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
const NO_REMOVALS = new Set();

// Leaflet treats string tooltip content as HTML. Location names are plain text.
const labelContent = (label) => {
    const content = document.createElement('span');
    content.textContent = label;
    return content;
};

/** Leaflet map of approved meeting locations, styled after the Check-in Map frames. */
export default function LocationsMap({
    locations,
    removingIds = NO_REMOVALS,
    selectedId,
    draft,
    onMapClick,
    onSelect,
    readOnly = false,
    onMapError,
    circleRadius = 45,
    fitCircle = false,
    userLocation = null,
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const pinsRef = useRef(null);
    const userRef = useRef(null);
    const framedRef = useRef(null);
    const handlersRef = useRef({ onMapClick, onSelect, onMapError });

    useEffect(() => {
        handlersRef.current = { onMapClick, onSelect, onMapError };
    });

    useEffect(() => {
        let map;
        let observer;
        let active = true;
        try {
            map = L.map(containerRef.current, { center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM });
            let tileError = false;
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            })
                .on('loading', () => {
                    tileError = false;
                    if (active) handlersRef.current.onMapError?.(false);
                })
                .on('tileerror', () => {
                    tileError = true;
                    if (active) handlersRef.current.onMapError?.(true);
                })
                .on('load', () => {
                    if (active) handlersRef.current.onMapError?.(tileError);
                })
                .addTo(map);
            if (!readOnly) {
                map.on('click', (event) => handlersRef.current.onMapClick?.(event.latlng));
            }
            pinsRef.current = L.layerGroup().addTo(map);
            userRef.current = L.layerGroup().addTo(map);
            mapRef.current = map;
            if (typeof ResizeObserver === 'function') {
                observer = new ResizeObserver(() => map.invalidateSize());
                observer.observe(containerRef.current);
            }
        } catch {
            handlersRef.current.onMapError?.(true);
        }
        return () => {
            active = false;
            observer?.disconnect();
            map?.remove();
            mapRef.current = null;
            pinsRef.current = null;
            userRef.current = null;
            framedRef.current = null;
        };
    }, [readOnly]);

    useEffect(() => {
        const pins = pinsRef.current;
        if (!pins) return;
        pins.clearLayers();
        let circleBounds;

        for (const location of locations) {
            const removing = removingIds.has(location.location_id);
            const selected = location.location_id === selectedId;
            const state = removing ? 'removing' : selected ? 'selected' : 'saved';
            if (selected) {
                const circle = L.circle([location.lat, location.lng], {
                    radius: circleRadius,
                    color: removing ? '#9aa5b4' : '#24364f',
                    weight: 1,
                    fillColor: removing ? '#9aa5b4' : '#3f6fa0',
                    fillOpacity: 0.12,
                    interactive: false,
                }).addTo(pins);
                if (fitCircle) circleBounds = circle.getBounds();
            }
            const marker = L.marker([location.lat, location.lng], {
                icon: pinIcon(state), title: location.label, riseOnHover: true, draggable: false,
            })
                .bindTooltip(labelContent(removing ? `${location.label} (will be removed)` : location.label), LABEL_OPTIONS)
                .addTo(pins);
            if (!readOnly) {
                marker.on('click', (event) => {
                    L.DomEvent.stop(event);
                    handlersRef.current.onSelect?.(location.location_id);
                });
            }
        }

        if (draft && !readOnly) {
            L.marker([draft.lat, draft.lng], { icon: pinIcon('draft'), interactive: false })
                .bindTooltip(labelContent(draft.label?.trim() || 'New location'), LABEL_OPTIONS)
                .addTo(pins);
        }

        // Frame the saved pins once, when they first arrive, so later clicks don't move the map.
        const frame = readOnly ? JSON.stringify([locations.map(({ lat, lng }) => [lat, lng]), circleRadius, fitCircle, selectedId, Boolean(userLocation)]) : 'admin';
        if (locations.length > 0 && framedRef.current !== frame) {
            framedRef.current = frame;
            const bounds = circleBounds || L.latLngBounds(locations.map((location) => [location.lat, location.lng]));
            if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
            mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
        }
    }, [locations, removingIds, selectedId, draft, readOnly, circleRadius, fitCircle, userLocation]);

    useEffect(() => {
        const layer = userRef.current;
        if (!layer) return;
        layer.clearLayers();
        if (!userLocation) return;
        const point = [userLocation.lat, userLocation.lng];
        L.circle(point, {
            radius: userLocation.accuracy, color: '#1677d2', weight: 1,
            fillColor: '#1677d2', fillOpacity: 0.15, interactive: false,
        }).addTo(layer);
        L.circleMarker(point, {
            radius: 7, color: '#fff', weight: 2, fillColor: '#1677d2', fillOpacity: 1,
        }).bindTooltip(labelContent('Your location'), LABEL_OPTIONS).addTo(layer);
    }, [userLocation, readOnly]);

    return (
        <div
            ref={containerRef}
            className={`kv-locations-map${readOnly ? ' kv-locations-map--readonly' : ''}`}
            data-testid="locations-map"
            role={readOnly ? 'region' : 'application'}
            aria-label={readOnly
                ? 'Meeting location map'
                : 'Approved meeting locations map. Click to mark a new location; click a pin to select it.'}
        />
    );
}
