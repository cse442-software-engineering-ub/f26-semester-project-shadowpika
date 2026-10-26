import { useEffect, useRef, useState } from 'react';
import { fetchCheckin, geolocationError, LOCATION_OPTIONS, positionResult, submitCheckin, validLocation, windowState } from './checkin.js';

// One lifecycle owns requests, geolocation and timers. Generation checks discard callbacks
// from an earlier page visit, hidden tab or superseded request (including StrictMode cleanup).
export default function useCheckin(requestId) {
    const actions = useRef({});
    const [view, setView] = useState({ meeting: null, loading: true, error: '', geoMessage: '', busy: false, allowed: false });
    useEffect(() => {
        let disposed = false;
        let generation = 0;
        let fetchSequence = 0;
        let controller;
        let watchId = null;
        let readingTimer;
        let boundaryTimer;
        let meeting = null;
        let position = null;
        let wanted = false;
        let loading = true;
        let busy = false;
        let error = '';
        let geoError = '';
        let anchor = 0;
        let anchorTick = 0;
        let previousWindow;

        const serverNow = () => anchor + performance.now() - anchorTick;
        const stopWatch = () => {
            if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
            watchId = null;
            clearTimeout(readingTimer);
        };
        const publish = () => {
            if (disposed) return;
            const state = meeting ? windowState(meeting, serverNow()) : null;
            const result = positionResult(position, meeting);
            const coords = position?.coords;
            const userLocation = !document.hidden && !meeting?.checked_in_at && coords
                && validLocation({ lat: coords.latitude, lng: coords.longitude })
                && Number.isFinite(coords.accuracy) && coords.accuracy >= 0
                && Number.isFinite(position.timestamp) && Date.now() - position.timestamp <= 30000
                && position.timestamp - Date.now() <= 5000
                ? { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy } : null;
            setView({ meeting, loading, busy, error, state, geoMessage: geoError || result.message,
                userLocation,
                allowed: !document.hidden && !loading && !busy && !error && state === 'open' && result.allowed });
        };
        const acceptPosition = (value) => {
            position = value;
            geoError = '';
            clearTimeout(readingTimer);
            readingTimer = setTimeout(publish, Math.max(0, Math.min(35001, value.timestamp + 30001 - Date.now())));
            publish();
        };
        const startWatch = (preserveReading = false) => {
            stopWatch();
            if (!preserveReading) position = null;
            if (!navigator.geolocation) {
                geoError = 'Location is not supported by this browser. Use a device with location enabled.';
                publish();
                return;
            }
            if (document.hidden || disposed || meeting?.checked_in_at) return;
            if (!preserveReading) geoError = 'Checking your location...';
            const token = generation;
            watchId = navigator.geolocation.watchPosition((value) => {
                if (!disposed && token === generation && !document.hidden && !meeting?.checked_in_at) acceptPosition(value);
            }, (failure) => {
                if (disposed || token !== generation || document.hidden) return;
                position = null;
                geoError = geolocationError(failure);
                if (failure.code === 1) stopWatch();
                else clearTimeout(readingTimer);
                publish();
            }, LOCATION_OPTIONS);
            publish();
        };
        const refresh = async () => {
            if (disposed || document.hidden) return;
            const sequence = ++fetchSequence;
            controller?.abort();
            controller = new AbortController();
            loading = true;
            error = '';
            publish();
            try {
                const next = await fetchCheckin(requestId, controller.signal);
                if (disposed || sequence !== fetchSequence || document.hidden) return;
                meeting = next;
                anchor = Date.parse(next.server_now);
                anchorTick = performance.now();
                previousWindow = windowState(meeting, serverNow());
                if (meeting.checked_in_at) { generation++; stopWatch(); position = null; busy = false; }
                else if (wanted && watchId === null && !busy) startWatch(true);
                clearTimeout(boundaryTimer);
                const boundary = previousWindow === 'not_open' ? Date.parse(meeting.opens_at)
                    : previousWindow === 'open' ? Date.parse(meeting.closes_at) + 1 : null;
                if (boundary !== null) boundaryTimer = setTimeout(() => { publish(); refresh(); }, Math.min(2147483647, Math.max(1, boundary - serverNow())));
            } catch (failure) {
                if (disposed || sequence !== fetchSequence || failure.name === 'AbortError') return;
                error = failure.message || 'Could not connect to the server.';
            } finally {
                if (!disposed && sequence === fetchSequence) { loading = false; publish(); }
            }
        };
        const allow = () => {
            if (busy || disposed || meeting?.checked_in_at) return;
            wanted = true;
            generation++;
            error = '';
            startWatch();
        };
        const submit = async () => {
            if (disposed || document.hidden || loading || busy || error || !meeting
                || windowState(meeting, serverNow()) !== 'open' || !positionResult(position, meeting).allowed) return;
            busy = true;
            error = '';
            stopWatch();
            const token = ++generation;
            publish();
            try {
                const fresh = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, LOCATION_OPTIONS));
                if (disposed || token !== generation || document.hidden) return;
                acceptPosition(fresh);
                const result = positionResult(fresh, meeting);
                if (!result.allowed || windowState(meeting, serverNow()) !== 'open') return;
                const checkedAt = await submitCheckin(requestId, fresh);
                if (disposed || token !== generation || document.hidden) return;
                meeting = { ...meeting, checked_in_at: checkedAt, checkin_state: 'checked_in' };
                stopWatch();
                position = null;
            } catch (failure) {
                if (disposed || token !== generation) return;
                if (typeof failure.code === 'number') { position = null; geoError = geolocationError(failure); }
                else {
                    error = failure.message || 'Could not connect to the server.';
                    // A POST may have reached the server despite a network failure. Reload its
                    // authoritative result before offering another submission.
                    const failureMessage = error;
                    await refresh();
                    if (!disposed && token === generation && !meeting?.checked_in_at) error = failureMessage;
                }
            } finally {
                if (!disposed && token === generation) {
                    busy = false;
                    if (!meeting?.checked_in_at && wanted && !geoError && !error) startWatch(true);
                    publish();
                }
            }
        };
        const visibility = () => {
            generation++;
            ++fetchSequence;
            controller?.abort();
            stopWatch();
            position = null;
            busy = false;
            loading = false;
            geoError = '';
            publish();
            if (!document.hidden) { refresh(); if (wanted) startWatch(); }
        };
        const restored = (event) => { if (event.persisted) visibility(); };
        actions.current = { allow, submit, refresh };
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('pageshow', restored);
        const timer = setInterval(() => {
            if (document.hidden || !meeting) return;
            const current = windowState(meeting, serverNow());
            if (current !== previousWindow && !busy) { previousWindow = current; refresh(); }
            publish();
        }, 1000);
        if (/^[1-9]\d*$/.test(requestId)) refresh();
        else { loading = false; error = 'A valid meeting request is required.'; publish(); }
        return () => {
            disposed = true;
            generation++;
            ++fetchSequence;
            controller?.abort();
            stopWatch();
            clearTimeout(boundaryTimer);
            clearInterval(timer);
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('pageshow', restored);
        };
    }, [requestId]);
    return { ...view, allow: () => actions.current.allow?.(), submit: () => actions.current.submit?.(), refresh: () => actions.current.refresh?.() };
}
