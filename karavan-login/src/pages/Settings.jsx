import { useEffect, useState } from 'react';
import NavBar from '../NavBar.jsx';
import ApprovedLocationsAdmin from '../components/ApprovedLocationsAdmin.jsx';
import { fetchApprovedLocations } from '../api.js';
import '../ProductSearch.css';
import '../styles/settings.css';

const TABS = ['General', 'Account', 'Customization'];

export default function Settings() {
    const [activeTab, setActiveTab] = useState('Account');
    // null while checking; the Admin tab only appears once the server confirms the admin role.
    const [adminLocations, setAdminLocations] = useState(null);

    useEffect(() => {
        let cancelled = false;
        fetchApprovedLocations()
            .then((result) => {
                if (!cancelled && result.success && Array.isArray(result.locations)) setAdminLocations(result.locations);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const tabs = adminLocations ? [...TABS, 'Admin'] : TABS;

    return (
        <div className="ps-page">
            <NavBar />
            <main className="ps-frame">
                <h1 className="ps-title">Settings</h1>
                <p className="kv-settings-description">Manage your preferences, account details, and app behavior.</p>

                <section className="kv-settings-card">
                    <div className="kv-settings-tabs" role="tablist" aria-label="Settings sections">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                id={`settings-tab-${tab}`}
                                aria-selected={activeTab === tab}
                                aria-controls="settings-panel"
                                className={`kv-settings-tab${activeTab === tab ? ' is-active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div id="settings-panel" className="kv-settings-content" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
                        {activeTab === 'Admin' && adminLocations ? (
                            <ApprovedLocationsAdmin initialLocations={adminLocations} />
                        ) : (
                            <p className="kv-settings-section__hint">This section is coming soon.</p>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
