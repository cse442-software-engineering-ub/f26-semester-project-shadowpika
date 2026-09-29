import KaravanCrest from './KaravanCrest.jsx';
import { pathFor } from '../routes.js';

export default function KaravanHeader({ children }) {
    return (
        <header className="kv-header">
            <a className="kv-header__brand" href={pathFor('login')} aria-label="Karavan home">
                <KaravanCrest size={40} />
                <span className="kv-wordmark">KARAVAN</span>
            </a>
            {children && <div className="kv-header__actions">{children}</div>}
        </header>
    );
}
