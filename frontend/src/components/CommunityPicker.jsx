import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CommunityPicker.css';

// Rendered under the nav bar (see .nav z-index) so the nav stays usable while it's open.
function CommunityPicker({ communities, loading, error, joiningId, leavingId, firstLogin, onJoin, onLeave, onClose }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        dialogRef.current?.focus();
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    let body;
    if (loading && communities.length === 0) {
        body = <p className="kv-communities-note">Loading communities…</p>;
    } else if (communities.length === 0) {
        body = <p className="kv-communities-note">No communities yet. Check back once community partners join Karavan.</p>;
    } else {
        body = (
            <ul className="kv-communities-list">
                {communities.map(({ community_id: id, name, joined, automatic, pending }) => {
                    const busy = joiningId !== null || leavingId !== null;
                    const joinLabel = joined ? 'Joined' : pending ? 'Pending approval' : joiningId === id ? 'Requesting…' : 'Request to Join';
                    return (
                        <li key={id} className="kv-communities-item">
                            <span className="kv-communities-name">
                                {name}
                                {automatic ? <span className="kv-communities-tag">Everyone is a member</span> : null}
                            </span>
                            <span className="kv-communities-actions">
                                {joined && !automatic ? (
                                    <button
                                        type="button"
                                        className="kv-communities-leave"
                                        aria-label={`Leave ${name}`}
                                        disabled={busy}
                                        onClick={() => onLeave(id)}
                                    >
                                        {leavingId === id ? 'Leaving…' : 'Leave'}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    className="kv-communities-join"
                                    aria-label={joined ? `Joined ${name}` : pending ? `Pending approval for ${name}` : `Request to Join ${name}`}
                                    disabled={joined || pending || busy}
                                    onClick={() => onJoin(id)}
                                >
                                    {joinLabel}
                                </button>
                            </span>
                        </li>
                    );
                })}
            </ul>
        );
    }

    return createPortal(
        <div className="kv-communities-layer">
            <div className="kv-communities-backdrop" onClick={onClose} aria-hidden="true" />
            <div
                ref={dialogRef}
                className="kv-communities-dialog"
                role="dialog"
                aria-labelledby="kv-communities-title"
                aria-describedby="kv-communities-intro"
                tabIndex={-1}
            >
                <h2 id="kv-communities-title" className="kv-communities-title">
                    {firstLogin ? 'Suggested communities' : 'Join a Community'}
                </h2>
                <p id="kv-communities-intro" className="kv-communities-intro">
                    {firstLogin
                        ? 'Welcome to Karavan! Join a community to connect with students and partners near you.'
                        : 'Request to join as many communities as you like. A community admin has to approve you before you can shop their items.'}
                </p>
                {error ? <p className="kv-communities-error" role="alert">{error}</p> : null}
                {body}
                <div className="kv-communities-footer">
                    <button type="button" className="kv-communities-dismiss" onClick={onClose}>
                        {firstLogin ? 'Skip for now' : 'Close'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default CommunityPicker;
