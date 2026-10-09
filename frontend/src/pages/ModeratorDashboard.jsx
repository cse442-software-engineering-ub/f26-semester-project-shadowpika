import { useEffect, useState } from 'react';
import KaravanHeader from '../components/KaravanHeader.jsx';
import PendingRequestCard from '../components/PendingRequestCard.jsx';
import { decideRequest, fetchPendingRequests, logout } from '../api.js';
import { pathFor } from '../routes.js';
import '../styles/karavan.css';

export default function ModeratorDashboard() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [itemErrors, setItemErrors] = useState({});
    const [confirmation, setConfirmation] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetchPendingRequests()
            .then((result) => {
                if (cancelled) return;
                if (result.status === 403) setForbidden(true);
                else if (result.success && Array.isArray(result.requests)) setRequests(result.requests);
                else setLoadError(result.error || 'Could not load requests.');
            })
            .catch(() => !cancelled && setLoadError('Could not reach the server.'))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, []);

    const handleDecide = async (request, action) => {
        setBusyId(request.request_id);
        setConfirmation('');
        setItemErrors((current) => ({ ...current, [request.request_id]: undefined }));
        try {
            const result = await decideRequest(request.request_id, action);
            if (result.success) {
                setRequests((current) => current.filter((item) => item.request_id !== request.request_id));
                setConfirmation(
                    `${action === 'approve' ? 'Approved' : 'Denied'} ${request.full_name}'s request for ${request.business_name}.`
                );
            } else if (result.status === 403) {
                setForbidden(true);
            } else {
                setItemErrors((current) => ({ ...current, [request.request_id]: result.error || 'Could not update this request.' }));
            }
        } catch {
            setItemErrors((current) => ({ ...current, [request.request_id]: 'Could not reach the server.' }));
        } finally {
            setBusyId(null);
        }
    };

    const handleLogout = async () => {
        await logout();
        window.location.assign(pathFor('login'));
    };

    if (forbidden) {
        return (
            <div className="kv-page">
                <KaravanHeader />
                <main className="kv-centered">
                    <section className="kv-card" role="alert">
                        <h1 className="kv-card__title">Moderator access required</h1>
                        <p className="kv-card__subtitle">
                            You do not have permission to perform this action. Sign in with a Karavan moderator account to
                            review community partner requests.
                        </p>
                        <a className="kv-button kv-button--gold" href={pathFor('login')}>
                            Go to Log In
                        </a>
                    </section>
                </main>
            </div>
        );
    }

    const count = requests.length;

    return (
        <div className="kv-page">
            <KaravanHeader>
                <button type="button" className="kv-link-button" onClick={handleLogout}>
                    Sign out
                </button>
            </KaravanHeader>

            <main className="kv-dashboard">
                <div className="kv-dashboard__intro">
                    <h1 className="kv-card__title">Pending partner requests</h1>
                    <p className="kv-card__subtitle">
                        Review each community partner's details and proof of ownership, then approve or deny their request.
                    </p>
                </div>

                <div role="status" aria-live="polite">
                    {confirmation && <p className="kv-confirmation-banner">{confirmation}</p>}
                </div>

                {loadError && (
                    <p className="kv-form-error" role="alert">
                        {loadError}
                    </p>
                )}

                {!loadError && loading && <p className="kv-dashboard__empty">Loading requests…</p>}

                {!loadError && !loading && count === 0 && (
                    <section className="kv-card kv-dashboard__empty-card">
                        <p className="kv-dashboard__empty">No pending requests. You're all caught up.</p>
                    </section>
                )}

                {count > 0 && (
                    <>
                        <p className="kv-summary">
                            {count} pending request{count === 1 ? '' : 's'} awaiting review.
                        </p>
                        <ul className="kv-request-list">
                            {requests.map((request) => (
                                <PendingRequestCard
                                    key={request.request_id}
                                    request={request}
                                    busy={busyId === request.request_id}
                                    error={itemErrors[request.request_id]}
                                    onDecide={handleDecide}
                                />
                            ))}
                        </ul>
                    </>
                )}
            </main>
        </div>
    );
}
