import React, { useCallback, useEffect, useState } from 'react';
import './NavBar.css';
import { fetchCommunities, joinCommunity, leaveCommunity, logout } from './api.js';
import { readJoinedCommunity, saveJoinedCommunity, takeCommunityPrompt } from './community.js';
import CommunityPicker from './components/CommunityPicker.jsx';
import { CaravanLogo, KaravanBrand } from './components/KaravanBrand.jsx';
import { appBase, pathFor } from './routes.js';

const JOIN_LABEL = 'Join a Community';

// Pages are relative to the site root, so the links also work from the settings/ pages.
const HOME_PAGE = 'home.html';

const NAV_LINKS = [
    { label: 'Home', page: HOME_PAGE, icon: HomeIcon },
    { label: 'Settings', page: 'settings/account-settings.html', icon: SettingsIcon },
    { label: 'Sell', page: 'sell.html', icon: CartIcon },
];

const SEARCH_PAGE = 'product-search.html';

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="7" />
            <line x1="15.8" y1="15.8" x2="21" y2="21" />
        </svg>
    );
}

function MenuIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
    );
}

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

function CartIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 3h3l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.76L21 7H6" />
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="18" cy="20" r="1.4" />
        </svg>
    );
}

function LogoutIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}

function CommunityIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 20v-.5A5.5 5.5 0 0 1 8.5 14h1A5.5 5.5 0 0 1 15 19.5v.5" />
            <circle cx="17" cy="9" r="2.6" />
            <path d="M16.5 14H17a4.5 4.5 0 0 1 4.5 4.5v.5" />
        </svg>
    );
}

// The "Join a Community" button only appears once list_communities.php confirms a login.
function useCommunities() {
    const [signedIn, setSignedIn] = useState(false);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [joined, setJoined] = useState(readJoinedCommunity);
    const [joiningId, setJoiningId] = useState(null);
    const [leaving, setLeaving] = useState(false);
    const [picker, setPicker] = useState(null); // null, 'first-login' or 'nav'

    const remember = useCallback((community) => {
        setJoined(community);
        saveJoinedCommunity(community);
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchCommunities();
            if (result.status === 200 && result.success && Array.isArray(result.communities)) {
                setSignedIn(true);
                setCommunities(result.communities);
                setError('');
                // The server knows best, e.g. after leaving or joining on another device.
                if ('joined_community_id' in result) {
                    const current = result.communities.find((c) => c.community_id === result.joined_community_id);
                    remember(current ? { community_id: current.community_id, name: current.name } : null);
                }
                return true;
            }
            if (result.status === 403) {
                setSignedIn(false);
                setPicker(null);
            } else {
                setError(result.error || 'Could not load communities. Please try again.');
            }
        } catch {
            setError('Could not load communities. Please try again.');
        } finally {
            setLoading(false);
        }
        return false;
    }, [remember]);

    useEffect(() => {
        const showSuggestions = takeCommunityPrompt();
        load().then((loaded) => {
            if (loaded && showSuggestions) setPicker('first-login');
        });
    }, [load]);

    const open = () => {
        setError('');
        setPicker('nav');
        load();
    };

    const close = useCallback(() => {
        setPicker(null);
        setError('');
    }, []);

    const join = async (communityId) => {
        setJoiningId(communityId);
        setError('');
        try {
            const result = await joinCommunity(communityId);
            if (result.status === 200 && result.success) {
                remember({ community_id: result.community_id, name: result.community_name });
                setPicker(null);
            } else {
                setError(result.error || 'Could not join that community. Please try again.');
            }
        } catch {
            setError('Could not join that community. Please try again.');
        } finally {
            setJoiningId(null);
        }
    };

    // The picker stays open so the user can pick a different community straight away.
    const leave = async () => {
        setLeaving(true);
        setError('');
        try {
            const result = await leaveCommunity();
            if (result.status === 200 && result.success) remember(null);
            else setError(result.error || 'Could not leave the community. Please try again.');
        } catch {
            setError('Could not leave the community. Please try again.');
        } finally {
            setLeaving(false);
        }
    };

    return { signedIn, communities, loading, error, joined, joiningId, leaving, picker, open, close, join, leave };
}

function NavBar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const community = useCommunities();
    const communityLabel = community.joined?.name ?? JOIN_LABEL;
    const communityTitle = community.joined ? 'Switch community' : undefined;
    const base = appBase();

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        window.location.assign(pathFor('login'));
    };

    // While the drawer is open: lock page scroll, let Escape close it, and close it
    // if the window grows to desktop width (where the drawer is hidden).
    useEffect(() => {
        if (!menuOpen) return undefined;

        const close = () => setMenuOpen(false);
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') close();
        };
        const desktop = window.matchMedia('(min-width: 769px)');
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', closeOnEscape);
        desktop.addEventListener('change', close);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', closeOnEscape);
            desktop.removeEventListener('change', close);
        };
    }, [menuOpen]);

    return (
        <header className="nav">
            <nav className="nav-bar" aria-label="Main">
                <KaravanBrand href={base + HOME_PAGE} />

                <div className="nav-right">
                    {/* Desktop only */}
                    <ul className="nav-links">
                        {NAV_LINKS.map((link) => (
                            <li key={link.label}>
                                <a className="nav-link" href={base + link.page}>{link.label}</a>
                            </li>
                        ))}
                    </ul>

                    <div className="nav-icons">
                        <a className="nav-icon-btn nav-search" href={base + SEARCH_PAGE} aria-label="Search">
                            <SearchIcon />
                        </a>
                        {/* Desktop only */}
                        {community.signedIn ? (
                            <button type="button" className="nav-community" title={communityTitle} onClick={community.open}>
                                <CommunityIcon />
                                <span className="nav-community-label">{communityLabel}</span>
                            </button>
                        ) : null}
                        {/* Desktop only */}
                        <button type="button" className="nav-link nav-text-button nav-logout" onClick={handleLogout}>
                            Log Out
                        </button>
                        {/* Mobile only */}
                        <button
                            type="button"
                            className="nav-icon-btn nav-menu-btn"
                            aria-label="Open menu"
                            aria-expanded={menuOpen}
                            aria-controls="nav-drawer"
                            onClick={() => setMenuOpen(true)}
                        >
                            <MenuIcon />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile menu: a drawer that slides in from the right over a dimmed page */}
            <div
                className={`nav-backdrop${menuOpen ? ' is-open' : ''}`}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
            />
            <aside
                id="nav-drawer"
                className={`nav-drawer${menuOpen ? ' is-open' : ''}`}
                aria-label="Menu"
                inert={!menuOpen}
            >
                <button
                    type="button"
                    className="nav-icon-btn nav-drawer-close"
                    aria-label="Close menu"
                    onClick={() => setMenuOpen(false)}
                >
                    <CloseIcon />
                </button>

                <a className="nav-drawer-brand" href={base + HOME_PAGE} aria-label="Karavan home">
                    <CaravanLogo />
                    <span className="nav-drawer-title">KARAVAN</span>
                    <span className="nav-drawer-tagline">Buy. Sell. Support Students.</span>
                </a>

                <ul className="nav-drawer-links">
                    {NAV_LINKS.map(({ label, page, icon: Icon }) => (
                        <li key={label}>
                            <a className="nav-drawer-link" href={base + page}>
                                <Icon />
                                {label}
                            </a>
                        </li>
                    ))}
                    {community.signedIn ? (
                        <li>
                            <button
                                type="button"
                                className="nav-drawer-link nav-drawer-button"
                                title={communityTitle}
                                onClick={() => {
                                    setMenuOpen(false);
                                    community.open();
                                }}
                            >
                                <CommunityIcon />
                                <span className="nav-community-label">{communityLabel}</span>
                            </button>
                        </li>
                    ) : null}
                    <li>
                        <button type="button" className="nav-drawer-link nav-drawer-button" onClick={handleLogout}>
                            <LogoutIcon />
                            Log Out
                        </button>
                    </li>
                </ul>
            </aside>

            {community.picker ? (
                <CommunityPicker
                    communities={community.communities}
                    loading={community.loading}
                    error={community.error}
                    joinedId={community.joined?.community_id ?? null}
                    joiningId={community.joiningId}
                    leaving={community.leaving}
                    firstLogin={community.picker === 'first-login'}
                    onJoin={community.join}
                    onLeave={community.leave}
                    onClose={community.close}
                />
            ) : null}
        </header>
    );
}

export default NavBar;
