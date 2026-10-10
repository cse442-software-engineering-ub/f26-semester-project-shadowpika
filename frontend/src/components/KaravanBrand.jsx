// The one Karavan logo: used by the navbar, the logo-only header, and the large centre logo.
// Its sizes and spacing come from NavBar.css (.nav-logo*) and karavan.css (.kv-hero*).

export function CaravanLogo({ className = 'nav-logo-icon' }) {
    return (
        <svg className={className} viewBox="0 0 52 36" fill="none" aria-hidden="true">
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

// Icon + wordmark at navbar size, linking to `href`.
export function KaravanBrand({ href }) {
    return (
        <a className="nav-logo" href={href} aria-label="Karavan home" data-testid="karavan-logo">
            <CaravanLogo />
            <span className="nav-logo-text">KARAVAN</span>
        </a>
    );
}

// Large centred logo for the login, sign-up and partner pages.
export function KaravanHero({ tagline }) {
    return (
        <div className="kv-hero">
            <CaravanLogo className="kv-hero__icon" />
            <span className="kv-hero__wordmark">KARAVAN</span>
            {tagline ? <span className="kv-hero__tagline">{tagline}</span> : null}
        </div>
    );
}
