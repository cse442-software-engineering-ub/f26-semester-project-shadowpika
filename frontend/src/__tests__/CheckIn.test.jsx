/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"https://aptitude.cse.buffalo.edu/CSE442/2026-Fall/cse-442j/postsprint/check-in.html?request_id=71"}
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckIn from '../CheckIn.jsx';
import { BLOCKED_LOCATION, distanceMeters, EARTH_RADIUS_M, LOCATION_OPTIONS, positionResult, windowState } from '../checkin.js';

vi.mock('../NavBar.jsx', () => ({ default: () => <nav>Karavan</nav> }));
vi.mock('../components/LocationsMap.jsx', () => ({ default: ({ circleRadius, readOnly, onMapError }) => (
    <div aria-label="Meeting location map" data-radius={circleRadius} data-readonly={String(readOnly)}>
        <button onClick={() => onMapError(true)}>Simulate map failure</button>
    </div>
) }));

const NOW = Date.parse('2026-11-06T17:00:00Z');
const BASE = {
    request_id: 71, listing_id: 81, name: 'Temporary Check-in Item', price: '12.00',
    meeting_date: '2026-11-06', meeting_time: '12:00', status: 'approved',
    location_label: 'Test Meeting Spot', location: { location_id: 91, label: 'Test Meeting Spot', lat: 43, lng: -78.78 },
    radius_m: 100, max_accuracy_m: 100, max_age_seconds: 30, timezone: 'America/New_York',
    opens_at: '2026-11-06T16:45:00Z', closes_at: '2026-11-06T19:00:00Z',
    server_now: '2026-11-06T17:00:00Z', checked_in_at: null, checkin_state: 'open',
};
const position = (overrides = {}) => ({ coords: { latitude: 43, longitude: -78.78, accuracy: 20, ...overrides }, timestamp: Date.now() });
let meeting, geo, watchSuccess, watchFailure, freshSuccess, freshFailure, fetchMock, hidden, postResponse;

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.history.replaceState({}, '', 'check-in.html?request_id=71');
    meeting = { ...BASE };
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    postResponse = () => new Response(JSON.stringify({ success: true, checked_in_at: '2026-11-06T17:03:00Z' }), { status: 200 });
    geo = {
        watchPosition: vi.fn((success, failure) => { watchSuccess = success; watchFailure = failure; return 12; }),
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn((success, failure) => { freshSuccess = success; freshFailure = failure; }),
    };
    vi.stubGlobal('navigator', { geolocation: geo });
    fetchMock = vi.fn(async (url) => {
        if (url.includes('get_meeting_checkin.php')) return new Response(JSON.stringify({ success: true, meeting }), { status: 200 });
        if (url.endsWith('/check_in_meeting.php')) return postResponse();
        throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.useRealTimers());

const mount = async () => { await act(async () => { render(<CheckIn />); }); };
const locate = async (reading = position()) => {
    fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));
    await act(async () => watchSuccess(reading));
};
const postCalls = () => fetchMock.mock.calls.filter(([url]) => url.endsWith('/check_in_meeting.php'));

describe('Frontend #205 check-in', () => {
    it('loads the meeting and requires explicit location access before enabling submission', async () => {
        await mount();
        expect(screen.getByRole('heading', { name: 'Meeting location' })).toBeVisible();
        expect(screen.getByText('Test Meeting Spot')).toBeVisible();
        expect(screen.getByText('Check-in is open until 2:00 PM.')).toBeVisible();
        expect(screen.getByLabelText('Meeting location map')).toHaveAttribute('data-radius', '100');
        expect(geo.watchPosition).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        await locate();
        expect(geo.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), LOCATION_OPTIONS);
        expect(screen.getByText("You're within the meeting area.")).toBeVisible();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
        expect(fetchMock.mock.calls[0][0]).toBe('./api/get_meeting_checkin.php?request_id=71');
        expect(fetchMock.mock.calls[0][1].credentials).toBe('same-origin');
    });

    it('gets a fresh reading at submit time and sends the exact contract only once', async () => {
        await mount();
        await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        expect(screen.getByRole('button', { name: 'Checking in...' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Checking in...' }));
        expect(geo.getCurrentPosition).toHaveBeenCalledExactlyOnceWith(expect.any(Function), expect.any(Function), LOCATION_OPTIONS);
        expect(postCalls()).toHaveLength(0);
        await act(async () => freshSuccess(position({ accuracy: 15 })));
        expect(postCalls()).toHaveLength(1);
        expect(JSON.parse(postCalls()[0][1].body)).toEqual({ request_id: 71, latitude: 43, longitude: -78.78, accuracy_m: 15, captured_at: NOW });
        expect(screen.getByText('Checked in at 12:03 PM.')).toBeVisible();
        expect(screen.queryByRole('button', { name: "I'm here" })).not.toBeInTheDocument();
        expect(geo.clearWatch).toHaveBeenCalledWith(12);
    });

    it('disables after moving away, poor accuracy and expired readings', async () => {
        await mount();
        await locate();
        await act(async () => watchSuccess(position({ latitude: 42.99 })));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        expect(screen.getByText(/Move within 100 m/)).toBeVisible();
        await act(async () => watchSuccess(position({ accuracy: 101 })));
        expect(screen.getByText(/accuracy is too low/)).toBeVisible();
        await act(async () => watchSuccess(position()));
        await act(async () => vi.advanceTimersByTime(30001));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        expect(screen.getByText(/reading expired/)).toBeVisible();
    });

    it('does not POST when the fresh submission reading is outside the area', async () => {
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        await act(async () => freshSuccess(position({ latitude: 42.99 })));
        expect(postCalls()).toHaveLength(0);
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        expect(screen.getByText(/Move within 100 m/)).toBeVisible();
        expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    });

    it.each([[1, BLOCKED_LOCATION], [2, 'Your location is unavailable.'], [3, 'Location lookup timed out.']])('handles location error %s and retries', async (code, text) => {
        await mount();
        fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));
        await act(async () => watchFailure({ code }));
        expect(screen.getByText((content) => content.startsWith(text))).toBeVisible();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        await locate();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
    });

    it('handles a permission denial during submission without sending a request', async () => {
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        await act(async () => freshFailure({ code: 1 }));
        expect(screen.getByText(BLOCKED_LOCATION)).toBeVisible();
        expect(postCalls()).toHaveLength(0);
    });

    it('keeps monitoring after a transient location failure and recovers without a new click', async () => {
        await mount(); await locate();
        await act(async () => watchFailure({ code: 2 }));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        expect(geo.clearWatch).not.toHaveBeenCalled();
        await act(async () => watchSuccess(position()));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
        expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    });

    it('supports the pre-opening plus blocked-location acceptance scenario', async () => {
        meeting = { ...BASE, meeting_date: '2026-12-18', meeting_time: '14:00', opens_at: '2026-12-18T18:45:00Z', closes_at: '2026-12-18T21:00:00Z' };
        await mount();
        expect(screen.getByText('Check-in opens at 1:45 PM on Dec 18.')).toBeVisible();
        await locate();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        await act(async () => watchFailure({ code: 1 }));
        expect(screen.getByText(BLOCKED_LOCATION)).toBeVisible();
    });

    it('invalidates hidden-page callbacks and fetches fresh state on return', async () => {
        await mount(); await locate();
        const oldSuccess = watchSuccess;
        hidden = true;
        fireEvent(document, new Event('visibilitychange'));
        expect(geo.clearWatch).toHaveBeenCalledWith(12);
        await act(async () => oldSuccess(position()));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        hidden = false;
        await act(async () => fireEvent(document, new Event('visibilitychange')));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        await act(async () => watchSuccess(position()));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
    });

    it('reloads after a failed submission without showing false success', async () => {
        postResponse = () => new Response(JSON.stringify({ success: false, error: 'Check-in has closed.' }), { status: 409 });
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        await act(async () => freshSuccess(position()));
        expect(screen.getByRole('alert')).toHaveTextContent('Check-in has closed.');
        expect(screen.queryByText(/Checked in at/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
    });

    it('reads persisted success on initial load without requesting location', async () => {
        meeting.checked_in_at = '2026-11-06T17:03:00Z';
        await mount();
        expect(screen.getByText('Checked in at 12:03 PM.')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Allow location' })).not.toBeInTheDocument();
        expect(geo.watchPosition).not.toHaveBeenCalled();
    });

    it('does not make map tiles a condition of check-in', async () => {
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: 'Simulate map failure' }));
        expect(screen.getByText(/The map could not load/)).toBeVisible();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
    });

    it('fails closed for an unsupported browser or missing location', async () => {
        meeting.location = null;
        vi.stubGlobal('navigator', {});
        await mount();
        fireEvent.click(screen.getByRole('button', { name: 'Allow location' }));
        expect(screen.getByText(/not supported by this browser/)).toBeVisible();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
    });

    it('does not fetch or offer submission for an invalid request ID', async () => {
        window.history.replaceState({}, '', 'check-in.html?request_id=bad');
        await mount();
        expect(screen.getByRole('alert')).toHaveTextContent('A valid meeting request is required.');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: "I'm here" })).not.toBeInTheDocument();
    });

    it('displays a load failure and can reload successfully', async () => {
        fetchMock.mockRejectedValueOnce(new Error('Could not connect to the server.'));
        await mount();
        expect(screen.getByRole('alert')).toHaveTextContent('Could not connect to the server.');
        await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload meeting' })));
        expect(screen.getByRole('heading', { name: BASE.name })).toBeVisible();
    });

    it('refreshes the authoritative state at the opening and closing boundaries', async () => {
        meeting = { ...BASE, opens_at: new Date(NOW + 1000).toISOString(), closes_at: new Date(NOW + 3000).toISOString() };
        await mount(); await locate();
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        meeting.server_now = new Date(NOW + 1000).toISOString();
        await act(async () => vi.advanceTimersByTime(1000));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeEnabled();
        meeting.server_now = new Date(NOW + 3001).toISOString();
        await act(async () => vi.advanceTimersByTime(2001));
        expect(screen.getByRole('button', { name: "I'm here" })).toBeDisabled();
        expect(screen.getByText('Check-in has closed.')).toBeVisible();
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('recovers a successful server check-in after the POST response is lost', async () => {
        postResponse = () => {
            meeting.checked_in_at = '2026-11-06T17:03:00Z';
            throw new Error('Connection lost');
        };
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        await act(async () => freshSuccess(position()));
        expect(screen.getByText('Checked in at 12:03 PM.')).toBeVisible();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: "I'm here" })).not.toBeInTheDocument();
    });

    it('ignores a pending submit-position callback after the page is hidden', async () => {
        await mount(); await locate();
        fireEvent.click(screen.getByRole('button', { name: "I'm here" }));
        hidden = true;
        fireEvent(document, new Event('visibilitychange'));
        await act(async () => freshSuccess(position()));
        expect(postCalls()).toHaveLength(0);
    });
});

describe('check-in numeric boundaries', () => {
    it('uses inclusive distance, accuracy and freshness limits', () => {
        const equator = { ...BASE, location: { lat: 0, lng: 0 } };
        for (const meters of [99.999, 100, 100.001]) {
            const latitude = meters / EARTH_RADIUS_M * 180 / Math.PI;
            const reading = position({ latitude, longitude: 0, accuracy: 100 });
            expect(positionResult(reading, equator).allowed).toBe(meters <= 100);
            expect(distanceMeters(latitude, 0, 0, 0)).toBeCloseTo(meters, 8);
        }
        expect(positionResult(position({ accuracy: 100.001 }), BASE).allowed).toBe(false);
        expect(positionResult({ ...position(), timestamp: NOW - 30000 }, BASE).allowed).toBe(true);
        expect(positionResult({ ...position(), timestamp: NOW - 30001 }, BASE).allowed).toBe(false);
        expect(positionResult({ ...position(), timestamp: NOW + 5001 }, BASE).allowed).toBe(false);
    });

    it('uses the server window including opening and closing endpoints', () => {
        expect(windowState(BASE, Date.parse(BASE.opens_at) - 1)).toBe('not_open');
        expect(windowState(BASE, Date.parse(BASE.opens_at))).toBe('open');
        expect(windowState(BASE, Date.parse(BASE.closes_at))).toBe('open');
        expect(windowState(BASE, Date.parse(BASE.closes_at) + 1)).toBe('closed');
        expect(windowState({ ...BASE, status: 'pending' }, NOW)).toBe('not_approved');
    });
});
