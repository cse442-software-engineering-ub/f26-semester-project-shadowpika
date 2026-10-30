import React from 'react';
import { validCheckinTime } from './listingSales.js';

const checkedTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function MeetingProgress({ request, seller = false }) {
    if (request.status !== 'approved') return null;
    const checked = request.checked_in_at;
    const valid = validCheckinTime(checked);
    const sellerTime = request.seller_checked_in_at;
    const sellerValid = validCheckinTime(sellerTime);
    return <div className="mr-progress">
        <p className="mr-location-locked">Meeting location locked after approval.</p>
        <p className={valid ? 'mr-checkin mr-success' : 'mr-checkin'} role="status">
            {valid ? <>{seller ? 'Buyer checked in at ' : 'Checked in at '}
                <time dateTime={checked}>{checkedTime.format(new Date(checked))}</time>.</>
                : checked !== null ? 'Check-in status unavailable.'
                    : seller ? 'Buyer has not checked in yet.' : 'Not checked in yet.'}
        </p>
        <p className={sellerValid ? 'mr-checkin mr-success' : 'mr-checkin'} role="status">
            {sellerValid ? <>{seller ? 'You checked in at ' : 'Seller checked in at '}
                <time dateTime={sellerTime}>{checkedTime.format(new Date(sellerTime))}</time>.</>
                : sellerTime !== null ? 'Seller check-in status unavailable.'
                    : seller ? 'You have not checked in yet.' : 'Seller has not checked in yet.'}
        </p>
        {request.listing_status === 'sold' ? <p className="mr-checkin mr-success" role="status">Listing sold.</p>
            : valid && sellerValid && <p className="mr-checkin">Both participants have checked in.</p>}
    </div>;
}
