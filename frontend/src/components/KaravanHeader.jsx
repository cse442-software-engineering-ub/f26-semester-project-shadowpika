import '../NavBar.css';
import { KaravanBrand } from './KaravanBrand.jsx';
import { pathFor } from '../routes.js';

// The universal header for pages without the navbar (log in, sign up, partner and moderator pages):
// the navbar's logo bar with no links. Pages that need an action (e.g. Log Out) pass it as children.
export default function KaravanHeader({ children }) {
    return (
        <header className="nav">
            <div className="nav-bar">
                <KaravanBrand href={pathFor('login')} />
                {children && <div className="nav-right">{children}</div>}
            </div>
        </header>
    );
}
