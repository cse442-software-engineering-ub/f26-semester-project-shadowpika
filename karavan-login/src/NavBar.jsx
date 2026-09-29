import React, { useEffect, useState } from 'react';
import './NavBar.css';

const HOME_HREF = './home.html';

const NAV_LINKS = [
    { label: 'Home', href: HOME_HREF, icon: HomeIcon },
    { label: 'Settings', href: './settings.html', icon: SettingsIcon },
    { label: 'Sell', href: './sell.html', icon: CartIcon },
];

const SEARCH_HREF = './product-search.html';
const PROFILE_HREF = './profile.html';

function CaravanLogo() {
    return (
        <svg className="nav-logo-icon" viewBox="0 0 52 36" fill="none" aria-hidden="true">
            {/* body */}
            <path d="M6 5h30c7.2 0 13 5.8 13 13v7a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" stroke="#1f2d44" strokeWidth="2.4" />
            {/* windows */}
            <rect x="8" y="10" width="11" height="7" rx="1.5" stroke="#1f2d44" strokeWidth="2" />
            <path d="M39 10h1.5a5 5 0 0 1 5 5v2H39z" stroke="#1f2d44" strokeWidth="2" strokeLinejoin="round" />
            {/* door */}
            <rect x="25" y="10" width="8" height="15" rx="1" fill="#d9a441" stroke="#1f2d44" strokeWidth="1.6" />
            <circle cx="31" cy="18" r="0.9" fill="#1f2d44" />
            {/* wheel */}
            <circle cx="15" cy="28" r="5" fill="#3f6fa0" stroke="#1f2d44" strokeWidth="2" />
            <circle cx="15" cy="28" r="1.6" fill="#f6f1ea" />
        </svg>
    );
}

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

function ProfileIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
        </svg>
    );
}

function NavBar() {
    const [menuOpen, setMenuOpen] = useState(false);

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
                <a className="nav-logo" href={HOME_HREF} aria-label="Karavan home">
                    <CaravanLogo />
                    <span className="nav-logo-text">KARAVAN</span>
                </a>

                <div className="nav-right">
                    {/* Desktop only */}
                    <ul className="nav-links">
                        {NAV_LINKS.map((link) => (
                            <li key={link.label}>
                                <a className="nav-link" href={link.href}>{link.label}</a>
                            </li>
                        ))}
                    </ul>

                    <div className="nav-icons">
                        <a className="nav-icon-btn nav-search" href={SEARCH_HREF} aria-label="Search">
                            <SearchIcon />
                        </a>
                        {/* Desktop only */}
                        <a className="nav-profile" href={PROFILE_HREF}>Profile</a>
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
                <a className="nav-drawer-brand" href={HOME_HREF} aria-label="Karavan home">
                    <CaravanLogo />
                    <span className="nav-drawer-title">KARAVAN</span>
                    <span className="nav-drawer-tagline">Buy. Sell. Support Students.</span>
                </a>

                <ul className="nav-drawer-links">
                    {NAV_LINKS.map(({ label, href, icon: Icon }) => (
                        <li key={label}>
                            <a className="nav-drawer-link" href={href}>
                                <Icon />
                                {label}
                            </a>
                        </li>
                    ))}
                    <li>
                        <a className="nav-drawer-link" href={PROFILE_HREF}>
                            <ProfileIcon />
                            Profile
                        </a>
                    </li>
                </ul>
            </aside>
        </header>
    );
}

export default NavBar;
