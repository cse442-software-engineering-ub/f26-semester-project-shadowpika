import React, { useState } from 'react';
import './NavBar.css';

// None of these pages exist yet, so every nav target goes to the 404 page.
// Swap each href for the real page once it is built (routing is a separate card).
const NOT_FOUND = './404.html';

const NAV_LINKS = [
    { label: 'Meeting Request', href: NOT_FOUND },
    { label: 'Settings', href: NOT_FOUND },
    { label: 'Sell', href: NOT_FOUND },
];

const HOME_HREF = NOT_FOUND;
const SEARCH_HREF = NOT_FOUND;
const NOTIFICATIONS_HREF = NOT_FOUND;
const PROFILE_HREF = NOT_FOUND;

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

function BellIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 16V11a6 6 0 0 0-12 0v5l-2 2h16z" />
            <path d="M10 21a2 2 0 0 0 4 0" />
            <line x1="12" y1="3" x2="12" y2="5" />
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

function NavBar() {
    const [menuOpen, setMenuOpen] = useState(false);

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
                        <a className="nav-icon-btn nav-bell" href={NOTIFICATIONS_HREF} aria-label="Notifications">
                            <BellIcon />
                        </a>
                        {/* Desktop only */}
                        <a className="nav-profile" href={PROFILE_HREF}>Profile</a>
                        {/* Mobile only */}
                        <button
                            type="button"
                            className="nav-icon-btn nav-menu-btn"
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}
                            aria-controls="nav-mobile-menu"
                            onClick={() => setMenuOpen((open) => !open)}
                        >
                            <MenuIcon />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile menu: the links that don't fit in the mobile bar */}
            {menuOpen && (
                <ul id="nav-mobile-menu" className="nav-mobile-menu">
                    {NAV_LINKS.map((link) => (
                        <li key={link.label}>
                            <a className="nav-mobile-link" href={link.href}>{link.label}</a>
                        </li>
                    ))}
                    <li>
                        <a className="nav-mobile-link" href={PROFILE_HREF}>Profile</a>
                    </li>
                </ul>
            )}
        </header>
    );
}

export default NavBar;
