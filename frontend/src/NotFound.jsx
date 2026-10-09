import React from 'react';
import NavBar from './NavBar.jsx';
import './NotFound.css';

// Every nav button points here until its real page exists.
function NotFound() {
    return (
        <div className="nf-page">
            <NavBar />
            <main className="nf-main">
                <p className="nf-code">404</p>
                <h1 className="nf-title">Page not found</h1>
                <p className="nf-text">The page you&rsquo;re looking for doesn&rsquo;t exist yet.</p>
                <button type="button" className="nf-back" onClick={() => window.history.back()}>
                    Go back
                </button>
            </main>
        </div>
    );
}

export default NotFound;
