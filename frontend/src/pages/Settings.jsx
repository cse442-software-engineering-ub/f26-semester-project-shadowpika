import { useEffect, useState } from 'react';
import NavBar from '../NavBar.jsx';
import ApprovedLocationsAdmin from '../components/ApprovedLocationsAdmin.jsx';
import PendingJoinRequests from '../components/PendingJoinRequests.jsx';
import { fetchAdminStatus, fetchApprovedLocations } from '../api.js';
import { appBase } from '../routes.js';
import '../ProductSearch.css';
import '../styles/settings.css';

// Account settings is Cristino's page in settings/; its Admin tab links back here.
export const ACCOUNT_SETTINGS_HREF = './settings/account-settings.html';
export const ADMIN_REGISTER_HREF = `${appBase()}index.html#/admin-register`;

export default function Settings() {
    const [applicationStatus, setApplicationStatus] = useState(null);
    const [adminLocations, setAdminLocations] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetchAdminStatus()
            .then(async (status) => {
                if (cancelled) return;
                const next = status.success ? status.application_status : 'none';
                setApplicationStatus(next);
                if (next !== 'approved') return;
                const locations = await fetchApprovedLocations();
                if (!cancelled && locations.success && Array.isArray(locations.locations)) {
                    setAdminLocations(locations.locations);
                }
            })
            .catch(() => {
                if (!cancelled) setApplicationStatus('none');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    let adminBody = <p className="kv-settings-section__hint">Checking your admin access…</p>;
    if (applicationStatus === 'none') {
        adminBody = (
            <div className="kv-admin-gate">
                <h2 className="kv-settings-section__title">Become a community admin</h2>
                <p className="kv-settings-section__hint">
                    Register as a community partner without logging out. A moderator reviews the request before you can manage a community.
                </p>
                <a className="kv-admin-gate__button" href={ADMIN_REGISTER_HREF}>
                    Register as an admin
                </a>
            </div>
        );
    } else if (applicationStatus === 'pending') {
        adminBody = (
            <div className="kv-admin-gate">
                <h2 className="kv-settings-section__title">Admin application</h2>
                <p className="kv-admin-gate__pending" role="status">Your request is being reviewed.</p>
            </div>
        );
    } else if (applicationStatus === 'approved') {
        adminBody = (
            <>
                <PendingJoinRequests />
                {adminLocations ? <ApprovedLocationsAdmin initialLocations={adminLocations} /> : null}
            </>
        );
    }

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame">
                <h1 className="ps-title">Settings</h1>
                <p className="kv-settings-description">Manage your preferences, account details, and app behavior.</p>

                <section className="kv-settings-card">
                    <div className="kv-settings-tabs" role="tablist" aria-label="Settings sections">
                        <button
                            type="button"
                            role="tab"
                            id="settings-tab-Account"
                            aria-selected="false"
                            className="kv-settings-tab"
                            onClick={() => window.location.assign(ACCOUNT_SETTINGS_HREF)}
                        >
                            Account
                        </button>
                        <button
                            type="button"
                            role="tab"
                            id="settings-tab-Admin"
                            aria-selected="true"
                            aria-controls="settings-panel"
                            className="kv-settings-tab is-active"
                        >
                            Admin
                        </button>
                    </div>

                    <div id="settings-panel" className="kv-settings-content" role="tabpanel" aria-labelledby="settings-tab-Admin">
                        {adminBody}
                    </div>
                </section>
            </main>
        </div>
    );
}
