import { useEffect, useState } from 'react';
import { fetchSession, isLocalMockBackend, isLoggedIn } from '../api.js';
import { pathFor } from '../routes.js';

// Shows the page only to signed-in users; everyone else is sent to the login page.
// replace() keeps the blocked page out of history, so Back can't return to it.
export default function RequireLogin({ children }) {
    const [allowed, setAllowed] = useState(isLocalMockBackend);

    useEffect(() => {
        if (isLocalMockBackend()) return undefined;
        let cancelled = false;

        const check = () =>
            fetchSession()
                .then((session) => {
                    if (cancelled) return;
                    if (isLoggedIn(session)) setAllowed(true);
                    else window.location.replace(pathFor('login'));
                })
                .catch(() => {
                    if (!cancelled) window.location.replace(pathFor('login'));
                });

        // Pages restored from the back/forward cache skip the first check, e.g. Back after logging out.
        const recheck = (event) => {
            if (event.persisted) check();
        };

        check();
        window.addEventListener('pageshow', recheck);
        return () => {
            cancelled = true;
            window.removeEventListener('pageshow', recheck);
        };
    }, []);

    return allowed ? children : null;
}
