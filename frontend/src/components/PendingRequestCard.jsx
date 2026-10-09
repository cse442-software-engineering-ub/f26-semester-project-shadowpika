import { proofUrl } from '../api.js';

function formatDate(value) {
    if (!value) return null;
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PendingRequestCard({ request, busy, error, onDecide }) {
    const applied = formatDate(request.created_at);

    return (
        <li className="kv-request" aria-label={`Request from ${request.full_name}`}>
            <div className="kv-request__info">
                <p className="kv-request__name">{request.full_name}</p>
                <p className="kv-request__business">{request.business_name}</p>
                <dl className="kv-request__details">
                    {request.email && (
                        <>
                            <dt>Email</dt>
                            <dd>{request.email}</dd>
                        </>
                    )}
                    {request.phone && (
                        <>
                            <dt>Phone</dt>
                            <dd>{request.phone}</dd>
                        </>
                    )}
                    {applied && (
                        <>
                            <dt>Applied</dt>
                            <dd>{applied}</dd>
                        </>
                    )}
                </dl>
                <a
                    className="kv-request__proof"
                    href={proofUrl(request.proof_of_ownership_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View proof of ownership
                </a>
                {error && (
                    <p className="kv-field-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <div className="kv-request__actions">
                <button
                    type="button"
                    className="kv-button kv-button--gold kv-button--small"
                    disabled={busy}
                    onClick={() => onDecide(request, 'approve')}
                >
                    Approve
                </button>
                <button
                    type="button"
                    className="kv-button kv-button--outline kv-button--small"
                    disabled={busy}
                    onClick={() => onDecide(request, 'deny')}
                >
                    Deny
                </button>
            </div>
        </li>
    );
}
