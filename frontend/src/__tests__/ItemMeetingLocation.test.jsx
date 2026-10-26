/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/item.html"}
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItemDetails from '../ItemDetails.jsx';
import LocationsMap from '../components/LocationsMap.jsx';
import ListingMeetingLocation from '../components/ListingMeetingLocation.jsx';

// Exercise the real shared map component against Leaflet's public API. No tiles,
// backend, or database are needed, and assertions verify actual marker coordinates.
const mapMocks = vi.hoisted(() => {
    const maps = [];
    const tiles = [];
    const markers = [];
    const eventLayer = () => {
        const layer = { handlers: {} };
        layer.on = vi.fn((event, listener) => {
            layer.handlers[event] = listener;
            return layer;
        });
        layer.addTo = vi.fn(() => layer);
        return layer;
    };
    const leaflet = {
        map: vi.fn(() => {
            const map = { ...eventLayer(), fitBounds: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn() };
            maps.push(map);
            return map;
        }),
        tileLayer: vi.fn(() => {
            const tile = eventLayer();
            tiles.push(tile);
            return tile;
        }),
        layerGroup: vi.fn(() => Object.assign(eventLayer(), { clearLayers: vi.fn() })),
        marker: vi.fn(() => {
            const marker = eventLayer();
            marker.bindTooltip = vi.fn(() => marker);
            markers.push(marker);
            return marker;
        }),
        circle: vi.fn(() => Object.assign(eventLayer(), { getBounds: vi.fn(() => 'circle-bounds') })),
        circleMarker: vi.fn(() => {
            const marker = eventLayer();
            marker.bindTooltip = vi.fn(() => marker);
            return marker;
        }),
        divIcon: vi.fn((options) => options),
        latLngBounds: vi.fn((points) => points),
        DomEvent: { stop: vi.fn() },
    };
    return { maps, tiles, markers, leaflet };
});

vi.mock('leaflet', () => ({ default: mapMocks.leaflet }));
vi.mock('../NavBar.jsx', () => ({ default: () => <nav aria-label="Main">Karavan</nav> }));

const CAPEN = { location_id: 91001, label: 'Capen Hall Main Entrance', lat: 43.000822, lng: -78.789203 };
const UNION = { location_id: 91002, label: 'Student Union Main Entrance', lat: 43.001054, lng: -78.786087 };
const LISTING = {
    listing_id: 9900091, owner_id: 12, name: 'Meeting Map Test Book', price: '25.00',
    condition: 'Good', category: 'Textbooks', community: 'Karavan',
    description: 'Meeting location map frontend test item.', image_url: null,
    meeting_location: CAPEN.label, meeting_location_details: CAPEN,
};

function mockBackend(status = 200, body = { success: true, listing: LISTING }) {
    const fetchMock = vi.fn((url) => {
        let responseStatus = 200;
        let responseBody = { success: true, is_owner: false, saved: false };
        if (url.includes('get_item_details.php')) {
            responseStatus = status;
            responseBody = body;
        }
        return Promise.resolve(new Response(JSON.stringify(responseBody), { status: responseStatus }));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

beforeEach(() => {
    vi.clearAllMocks();
    mapMocks.maps.length = 0;
    mapMocks.tiles.length = 0;
    mapMocks.markers.length = 0;
    window.history.replaceState({}, '', 'item.html?listing_id=9900091');
});

describe('Frontend #202: seller meeting-location map', () => {
    it('requests the listing and places one read-only pin at its returned coordinates', async () => {
        const fetchMock = mockBackend();
        render(<ItemDetails />);

        expect(await screen.findByRole('heading', { name: LISTING.name })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('./api/get_item_details.php?listing_id=9900091');
        expect(screen.getByRole('heading', { name: 'Meeting Location' })).toBeInTheDocument();
        expect(screen.getByText(CAPEN.label)).toBeVisible();
        expect(screen.getByRole('region', { name: 'Meeting location map' })).toBeInTheDocument();
        await waitFor(() => expect(mapMocks.leaflet.marker).toHaveBeenCalledExactlyOnceWith([CAPEN.lat, CAPEN.lng], expect.objectContaining({
            title: CAPEN.label, draggable: false,
        })));
        expect(mapMocks.markers[0].bindTooltip.mock.calls[0][0].textContent).toBe(CAPEN.label);
        expect(mapMocks.maps[0].fitBounds).toHaveBeenCalledWith([[CAPEN.lat, CAPEN.lng]], expect.any(Object));
        expect(mapMocks.maps[0].handlers.click).toBeUndefined();
        expect(mapMocks.markers[0].handlers.click).toBeUndefined();
        fireEvent.click(screen.getByRole('region', { name: 'Meeting location map' }));
        expect(fetchMock.mock.calls.every(([url]) => !url.includes('create_meeting_request') && !url.includes('update_listing'))).toBe(true);
    });

    it('reframes the pin when the displayed listing location changes', () => {
        const { rerender } = render(<ListingMeetingLocation listing={LISTING} />);
        const firstMap = mapMocks.maps[0];
        rerender(<ListingMeetingLocation listing={{ ...LISTING, listing_id: 9900092, meeting_location: UNION.label, meeting_location_details: UNION }} />);

        expect(firstMap.remove).toHaveBeenCalledOnce();
        expect(screen.getByText(UNION.label)).toBeVisible();
        expect(screen.queryByText(CAPEN.label)).not.toBeInTheDocument();
        expect(mapMocks.leaflet.marker).toHaveBeenLastCalledWith([UNION.lat, UNION.lng], expect.any(Object));
        expect(mapMocks.maps.at(-1).fitBounds).toHaveBeenCalledWith([[UNION.lat, UNION.lng]], expect.any(Object));
    });

    it.each([
        ['missing details', null],
        ['missing latitude', { ...CAPEN, lat: undefined }],
        ['null latitude', { ...CAPEN, lat: null }],
        ['nonnumeric latitude', { ...CAPEN, lat: 'not a number' }],
        ['infinite longitude', { ...CAPEN, lng: Infinity }],
        ['latitude outside bounds', { ...CAPEN, lat: 91 }],
        ['longitude outside bounds', { ...CAPEN, lng: -181 }],
    ])('preserves the location name without a misleading pin for %s', (_, location) => {
        render(<ListingMeetingLocation listing={{ ...LISTING, meeting_location_details: location }} />);

        expect(screen.getByText(CAPEN.label)).toBeVisible();
        expect(screen.getByText('Map unavailable for this meeting location.')).toBeVisible();
        expect(mapMocks.leaflet.map).not.toHaveBeenCalled();
        expect(mapMocks.leaflet.marker).not.toHaveBeenCalled();
    });

    it('explains when no meeting location was provided', () => {
        render(<ListingMeetingLocation listing={{ listing_id: 9900091 }} />);

        expect(screen.getByText('The seller has not provided a meeting location.')).toBeVisible();
        expect(screen.queryByRole('region', { name: 'Meeting location map' })).not.toBeInTheDocument();
        expect(mapMocks.leaflet.marker).not.toHaveBeenCalled();
    });

    it('accepts zero coordinates as valid instead of treating them as missing', () => {
        render(<ListingMeetingLocation listing={{ ...LISTING, meeting_location_details: { ...CAPEN, lat: 0, lng: 0 } }} />);
        expect(mapMocks.leaflet.marker).toHaveBeenCalledWith([0, 0], expect.any(Object));
    });

    it('keeps the location text visible on tile failure and clears the message after recovery', () => {
        render(<ListingMeetingLocation listing={LISTING} />);
        const tile = mapMocks.tiles[0];

        act(() => {
            tile.handlers.loading();
            tile.handlers.tileerror();
            tile.handlers.load();
        });
        expect(screen.getByRole('status')).toHaveTextContent("The map could not load. The seller's meeting location is shown above.");
        expect(screen.getByText(CAPEN.label)).toBeVisible();

        act(() => {
            tile.handlers.loading();
            tile.handlers.load();
        });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('keeps location text visible when map initialization fails', () => {
        mapMocks.leaflet.map.mockImplementationOnce(() => { throw new Error('Map initialization failed'); });
        render(<ListingMeetingLocation listing={LISTING} />);
        expect(screen.getByRole('status')).toHaveTextContent('The map could not load.');
        expect(screen.getByText(CAPEN.label)).toBeVisible();
    });

    it.each([
        [403, 'This item is only available to members of its community.'],
        [404, 'Listing not found.'],
    ])('shows the %s response without revealing a location', async (status, error) => {
        mockBackend(status, { success: false, error });
        render(<ItemDetails />);
        expect(await screen.findByRole('alert')).toHaveTextContent(error);
        expect(screen.queryByRole('heading', { name: 'Meeting Location' })).not.toBeInTheDocument();
        expect(mapMocks.leaflet.map).not.toHaveBeenCalled();
    });

    it('preserves the existing Message Seller action from the old compiled page', async () => {
        mockBackend();
        const assign = vi.fn();
        vi.stubGlobal('location', { ...window.location, assign });
        render(<ItemDetails />);

        fireEvent.click(await screen.findByRole('button', { name: 'Message Seller' }));
        await waitFor(() => expect(assign).toHaveBeenCalledOnce());
        const url = new URL(assign.mock.calls[0][0], 'https://aptitude.test/');
        expect(url.pathname).toBe('/message.html');
        expect(url.searchParams.get('with')).toBe('12');
        expect(url.searchParams.get('listing_id')).toBe(String(LISTING.listing_id));
    });
});

describe('Shared map: administrator compatibility', () => {
    it('draws and updates the user dot and accuracy circle, fits both positions once, and clears the overlay', () => {
        const bounds = { extend: vi.fn() };
        mapMocks.leaflet.circle.mockImplementationOnce(() => Object.assign({ addTo: vi.fn().mockReturnThis() }, { getBounds: () => bounds }));
        const locations = [CAPEN];
        const { rerender } = render(<LocationsMap locations={locations} selectedId={CAPEN.location_id} readOnly circleRadius={100} fitCircle
            userLocation={{ lat: 42.99, lng: -78.8, accuracy: 25 }} />);
        expect(bounds.extend).toHaveBeenCalledWith([42.99, -78.8]);
        expect(mapMocks.leaflet.circle).toHaveBeenLastCalledWith([42.99, -78.8], expect.objectContaining({ radius: 25, interactive: false }));
        expect(mapMocks.leaflet.circleMarker).toHaveBeenLastCalledWith([42.99, -78.8], expect.objectContaining({ fillColor: '#1677d2' }));
        expect(mapMocks.leaflet.circleMarker.mock.results.at(-1).value.bindTooltip.mock.calls[0][0].textContent).toBe('Your location');
        const map = mapMocks.maps[0];
        rerender(<LocationsMap locations={locations} selectedId={CAPEN.location_id} readOnly circleRadius={100} fitCircle
            userLocation={{ lat: 42.991, lng: -78.8, accuracy: 50 }} />);
        expect(map.fitBounds).toHaveBeenCalledTimes(1);
        expect(mapMocks.leaflet.circle).toHaveBeenLastCalledWith([42.991, -78.8], expect.objectContaining({ radius: 50 }));
        const userLayer = mapMocks.leaflet.layerGroup.mock.results[1].value;
        userLayer.clearLayers.mockClear();
        mapMocks.leaflet.circleMarker.mockClear();
        rerender(<LocationsMap locations={locations} selectedId={CAPEN.location_id} readOnly circleRadius={100} fitCircle />);
        expect(userLayer.clearLayers).toHaveBeenCalledOnce();
        expect(mapMocks.leaflet.circleMarker).not.toHaveBeenCalled();
    });
    it('keeps the default 45 m circle and frames the full 100 m check-in area when requested', () => {
        const { rerender } = render(<LocationsMap locations={[CAPEN]} selectedId={CAPEN.location_id} />);
        expect(mapMocks.leaflet.circle).toHaveBeenLastCalledWith([CAPEN.lat, CAPEN.lng], expect.objectContaining({ radius: 45 }));
        rerender(<LocationsMap locations={[CAPEN]} selectedId={CAPEN.location_id} readOnly circleRadius={100} fitCircle />);
        expect(mapMocks.leaflet.circle).toHaveBeenLastCalledWith([CAPEN.lat, CAPEN.lng], expect.objectContaining({ radius: 100 }));
        expect(mapMocks.maps.at(-1).fitBounds).toHaveBeenLastCalledWith('circle-bounds', expect.any(Object));
        expect(mapMocks.maps.at(-1).handlers.click).toBeUndefined();
    });
    it('still reports administrator map clicks and pin selection', () => {
        const onMapClick = vi.fn();
        const onSelect = vi.fn();
        render(<LocationsMap locations={[CAPEN]} onMapClick={onMapClick} onSelect={onSelect} />);

        act(() => mapMocks.maps[0].handlers.click({ latlng: { lat: 43, lng: -78 } }));
        expect(onMapClick).toHaveBeenCalledWith({ lat: 43, lng: -78 });
        act(() => mapMocks.markers[0].handlers.click({}));
        expect(onSelect).toHaveBeenCalledWith(CAPEN.location_id);
        expect(screen.getByRole('application')).toHaveAccessibleName(/Click to mark a new location/);
    });

    it('reframes a read-only map when its coordinates change and treats labels as text', () => {
        const { rerender } = render(<LocationsMap locations={[CAPEN]} readOnly />);
        rerender(<LocationsMap locations={[{ ...UNION, label: '<b>Student Union</b>' }]} readOnly />);

        expect(mapMocks.maps[0].fitBounds).toHaveBeenLastCalledWith([[UNION.lat, UNION.lng]], expect.any(Object));
        const tooltip = mapMocks.markers.at(-1).bindTooltip.mock.calls[0][0];
        expect(tooltip.textContent).toBe('<b>Student Union</b>');
        expect(tooltip.querySelector('b')).toBeNull();
    });
});
