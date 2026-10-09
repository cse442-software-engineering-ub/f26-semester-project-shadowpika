export default function KaravanCrest({ size = 48, className = '' }) {
    return (
        <svg
            className={`kv-crest ${className}`.trim()}
            data-testid="karavan-logo"
            width={size}
            height={size * 0.75}
            viewBox="0 0 64 48"
            fill="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M7 7h35c9.4 0 17 7.6 17 17v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z"
                fill="#FFFFFF"
                stroke="#1F3A5F"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <rect x="9" y="13" width="17" height="9" rx="3" fill="#FFFFFF" stroke="#1F3A5F" strokeWidth="3" />
            <rect x="37" y="13" width="10" height="24" fill="#C9A15B" stroke="#1F3A5F" strokeWidth="3" />
            <circle cx="39.8" cy="26" r="1.4" fill="#1F3A5F" />
            <circle cx="18" cy="38" r="6.5" fill="#FFFFFF" stroke="#1F3A5F" strokeWidth="3" />
            <circle cx="18" cy="38" r="2" fill="#1F3A5F" />
        </svg>
    );
}
