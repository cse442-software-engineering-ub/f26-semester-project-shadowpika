import React from 'react';

const checkedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function MeetingProgress({ request, seller = false }) {
    if (request.status !== 'approved') return null;
    const checked = request.checked_in_at;
    const valid = checked && Number.isFinite(Date.parse(checked));
    return <div className="mr-progress">
        <p className="mr-location-locked">Meeting location locked after approval.</p>
        <p className={valid ? 'mr-checkin mr-success' : 'mr-checkin'} role="status">
            {valid ? <>{seller ? 'Buyer checked in at ' : 'Checked in at '}
                <time dateTime={checked}>{checkedTime.format(new Date(checked))}</time>.</>
                : checked !== null ? 'Check-in status unavailable.'
                    : seller ? 'Buyer has not checked in yet.' : 'Not checked in yet.'}
        </p>
    </div>;
}
