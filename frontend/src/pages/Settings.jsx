import { useEffect, useState } from 'react';
import NavBar from '../NavBar.jsx';
import ApprovedLocationsAdmin from '../components/ApprovedLocationsAdmin.jsx';
import { fetchApprovedLocations } from '../api.js';
import '../ProductSearch.css';
import '../styles/settings.css';

// Account settings is Cristino's page in settings/; its Admin tab links back here.
export const ACCOUNT_SETTINGS_HREF = './settings/account-settings.html';

export default function Settings() {
    // null while checking; the Admin tab only appears once the server confirms the admin role.
    const [adminLocations, setAdminLocations] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetchApprovedLocations()
            .then((result) => {
                if (cancelled) return;
                if (result.success && Array.isArray(result.locations)) setAdminLocations(result.locations);
                else window.location.replace(ACCOUNT_SETTINGS_HREF);
            })
            .catch(() => {
                if (!cancelled) window.location.replace(ACCOUNT_SETTINGS_HREF);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
                        {adminLocations ? (
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
                        ) : null}
                    </div>

                    {adminLocations ? (
                        <div id="settings-panel" className="kv-settings-content" role="tabpanel" aria-labelledby="settings-tab-Admin">
                            <ApprovedLocationsAdmin initialLocations={adminLocations} />
                        </div>
                    ) : null}
                </section>
            </main>
        </div>
    );
}
