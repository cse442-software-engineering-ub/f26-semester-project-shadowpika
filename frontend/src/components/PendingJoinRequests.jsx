import { useEffect, useState } from 'react';
import { decideJoinRequest, fetchJoinRequests } from '../api.js';

export default function PendingJoinRequests() {
    const [requests, setRequests] = useState(null);
    const [busyKey, setBusyKey] = useState(null);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const load = async () => {
        const result = await fetchJoinRequests();
        if (result.status === 200 && result.success && Array.isArray(result.requests)) {
            setRequests(result.requests);
            setError('');
            return;
        }
        setRequests([]);
        setError(result.error || 'Could not load join requests.');
    };

    useEffect(() => {
        load();
    }, []);

    const decide = async (request, action) => {
        const key = `${request.user_id}-${request.community_id}-${action}`;
        setBusyKey(key);
        setError('');
        try {
            const result = await decideJoinRequest(request.user_id, request.community_id, action);
            if (result.status === 200 && result.success) {
                setRequests((current) => (current ?? []).filter(
                    (row) => !(row.user_id === request.user_id && row.community_id === request.community_id)
                ));
                setNotice(action === 'approve'
                    ? `Approved ${request.email}'s request to join ${request.community_name}.`
                    : `Denied ${request.email}'s request to join ${request.community_name}.`);
            } else {
                setError(result.error || 'Could not update that request.');
            }
        } catch {
            setError('Could not update that request.');
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <section className="kv-join-requests" aria-labelledby="pending-join-title">
            <h2 id="pending-join-title" className="kv-settings-section__title">Pending join requests</h2>
            <p className="kv-settings-section__hint">Approve shoppers before they can see your community&apos;s listings.</p>
            {notice ? <p className="kv-join-requests__notice" role="status">{notice}</p> : null}
            {error ? <p className="kv-join-requests__error" role="alert">{error}</p> : null}
            {requests === null ? (
                <p className="kv-settings-section__hint">Loading join requests…</p>
            ) : requests.length === 0 ? (
                <p className="kv-settings-section__hint">No pending join requests</p>
            ) : (
                <ul className="kv-join-requests__list">
                    {requests.map((request) => {
                        const approveKey = `${request.user_id}-${request.community_id}-approve`;
                        const denyKey = `${request.user_id}-${request.community_id}-deny`;
                        return (
                            <li key={`${request.user_id}-${request.community_id}`} className="kv-join-requests__item">
                                <div>
                                    <strong>{request.email}</strong>
                                    <span> wants to join {request.community_name}</span>
                                </div>
                                <div className="kv-join-requests__actions">
                                    <button
                                        type="button"
                                        className="kv-join-requests__approve"
                                        disabled={busyKey !== null}
                                        onClick={() => decide(request, 'approve')}
                                    >
                                        {busyKey === approveKey ? 'Approving…' : 'Approve'}
                                    </button>
                                    <button
                                        type="button"
                                        className="kv-join-requests__deny"
                                        disabled={busyKey !== null}
                                        onClick={() => decide(request, 'deny')}
                                    >
                                        {busyKey === denyKey ? 'Denying…' : 'Deny'}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
