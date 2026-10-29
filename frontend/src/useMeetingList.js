import { useEffect, useRef, useState } from 'react';

export const MEETING_REFRESH_MS = 15000;

// One lifecycle owns background reads. Mutations invalidate earlier reads so an
// old poll cannot restore a canceled request or undo a successful approval.
export default function useMeetingList(load, failureMessage) {
    const actions = useRef({});
    const [view, setView] = useState({ requests: [], status: 'loading', error: '' });
    useEffect(() => {
        let disposed = false;
        let sequence = 0;
        let pending = false;
        let mutating = false;
        const refresh = async (force = true) => {
            if (disposed || document.hidden || mutating || (!force && pending)) return;
            const token = ++sequence;
            pending = true;
            try {
                const data = await load();
                if (disposed || token !== sequence || document.hidden) return;
                if (!data.success || !Array.isArray(data.requests)) throw new Error(data.error || failureMessage);
                setView({ requests: data.requests, status: 'done', error: '' });
            } catch (failure) {
                if (disposed || token !== sequence || document.hidden) return;
                setView((previous) => ({ ...previous, status: previous.status === 'done' ? 'done' : 'error',
                    error: failure instanceof TypeError ? 'Could not connect to the server.' : failure.message || failureMessage }));
            } finally {
                if (token === sequence) pending = false;
            }
        };
        const visibility = () => {
            ++sequence;
            pending = false;
            if (!document.hidden) refresh();
        };
        const focus = () => { if (!document.hidden) refresh(); };
        const restored = (event) => { if (event.persisted) visibility(); };
        actions.current = {
            refresh,
            startMutation: () => {
                if (disposed || mutating) return false;
                mutating = true;
                ++sequence;
                pending = false;
                return true;
            },
            finishMutation: () => { mutating = false; },
            setRequests: (update) => {
                if (disposed) return;
                ++sequence;
                pending = false;
                setView((previous) => ({ ...previous, status: 'done', error: '', requests: update(previous.requests) }));
            },
        };
        refresh();
        const timer = setInterval(() => refresh(false), MEETING_REFRESH_MS);
        document.addEventListener('visibilitychange', visibility);
        window.addEventListener('focus', focus);
        window.addEventListener('pageshow', restored);
        return () => {
            disposed = true;
            ++sequence;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('focus', focus);
            window.removeEventListener('pageshow', restored);
            actions.current = {};
        };
    }, [load, failureMessage]);
    return { ...view,
        refresh: () => actions.current.refresh?.(),
        startMutation: () => actions.current.startMutation?.() ?? false,
        finishMutation: () => actions.current.finishMutation?.(),
        setRequests: (update) => actions.current.setRequests?.(update),
    };
}
