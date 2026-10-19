import React, { useState, useEffect } from 'react';
import './index.css'
import './styles/karavan.css'
import KaravanHeader from './components/KaravanHeader.jsx';
import { KaravanHero } from './components/KaravanBrand.jsx';
import { pathFor } from './routes.js';
import { markNewAccount, recordLogin } from './community.js';
import { fetchSession, isLocalMockBackend, isLoggedIn } from './api.js';

const HOME_PAGE = './home.html';

// Moderators work from the moderator dashboard rather than the marketplace home page.
const landingPageFor = (role) => (role === 'moderator' ? pathFor('moderator') : HOME_PAGE);

function App() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState(''); // NEW
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // NEW
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // ROUTING CONFIGURATION: Detects if this is the separate register page view
    const isRegisterPage = window.location.pathname.includes('register') || window.location.hash === '#register';

    // Someone already signed in (including a remembered login) skips the form and goes home.
    useEffect(() => {
        if (isLocalMockBackend()) {
            setIsLoading(false);
            return undefined;
        }
        let cancelled = false;
        fetchSession()
            .then((session) => {
                if (cancelled) return;
                if (isLoggedIn(session)) window.location.replace(landingPageFor(session.role));
                else setIsLoading(false);
            })
            .catch(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const registerSuccess = () => {
        setPassword('');
        setMessage('Account successfully created! Please log in.');
    };

    const loginSuccess = () => {
        setMessage('Login successful!');
        window.location.href = HOME_PAGE;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate that passwords match during registration
        if (isRegisterPage && password !== confirmPassword) {
            setMessage('Error: Passwords do not match.');
            return;
        }

        setMessage(isRegisterPage ? 'Writing to database...' : 'Logging in...');

        // 1. LOCAL MACHINE PREVIEW MODE
        if (isLocalMockBackend()) {
            setTimeout(() => {
                const currentTable = JSON.parse(localStorage.getItem('cse442_users_table')) || [
                    { id: 1, username: 'admin', password_hash: 'local_hash', email: 'admin@example.com' }
                ];

                if (isRegisterPage) {
                    const userExists = currentTable.some(u => u.username.toLowerCase() === username.toLowerCase());
                    if (userExists) {
                        setMessage('Error: Username already exists in database.');
                    } else {
                        // Added email column to local storage mock row
                        const newRow = {
                            id: currentTable.length + 1,
                            username: username,
                            password_hash: 'local_hash',
                            email: email
                        };
                        localStorage.setItem('cse442_users_table', JSON.stringify([...currentTable, newRow]));
                        setMessage('SUCCESS: Saved row directly to database table! Redirecting to login...');
                        setTimeout(() => {
                            window.location.href = './index.html';
                        }, 1500);
                    }
                } else {
                    const lowerEmail = email.trim().toLowerCase();
                    const isDemoAccount =
                        ((lowerEmail === 'admin' || lowerEmail === 'admin@example.com') && password === 'password123') ||
                        (lowerEmail === 'liveuser777' && password === 'SecretPass777');
                    const existingUser = currentTable.some(u => u.email && u.email.toLowerCase() === lowerEmail);
                    if (isDemoAccount || (existingUser && password.length > 0)) {
                        loginSuccess();
                    } else {
                        setMessage('Incorrect email or password. Please try again.');
                    }
                }
            }, 600);
            return;
        }

        // 2. PRODUCTION MODE (Submitting data live to UB Server)
        const targetScript = isRegisterPage ? './register.php' : './login.php';
        try {
            // Construct payload dynamically depending on the page mode
            const payload = isRegisterPage
                ? { username, email, password }
                : { email, password };

            const response = await fetch(targetScript, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data.success) {
                if (isRegisterPage) {
                    markNewAccount(email);
                    setMessage('Account successfully saved! Redirecting to login...');
                    setTimeout(() => {
                        window.location.href = './index.html';
                    }, 1500);
                    return;
                }
                recordLogin(email, data);
                if (data.role === 'moderator') {
                    window.location.assign(pathFor('moderator'));
                } else {
                    setMessage('Login successful!');
                    window.location.href = HOME_PAGE;
                }
            } else {
                setMessage(data.error || 'An error occurred.');
            }
        } catch (error) {
            setMessage('Could not connect to database.');
        }
    };

    if (isLoading) {
        return <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>Loading...</div>;
    }

    return (
        // Fills the window at any size: the header spans the top and the logo + form sit side by side,
        // stacking when the screen is too narrow for both.
        <div style={{ width: '100%', minHeight: '100vh', background: '#F7F3EA', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch', display: 'flex' }}>
            <KaravanHeader />

            <div style={{ alignSelf: 'stretch', flex: 1, boxSizing: 'border-box', padding: '32px 16px', background: '#F7F3EA', justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                <div style={{ width: '100%', maxWidth: 1018, flexWrap: 'wrap', columnGap: 64, rowGap: 32, justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                    <div style={{ width: 438.36, maxWidth: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                        <KaravanHero />
                    </div>
               
                    {/*                    {message && (
                    <p style={{ textAlign: 'center', fontWeight: 'bold', color: message.includes('SUCCESS') || message.includes('successful') ? 'green' : 'orange' }}>
                        {message}
                    </p>
                    )}*/}

                    <form onSubmit={handleSubmit} style={{
                        width: '100%', maxWidth: 458.16, boxSizing: 'border-box', paddingLeft: 31.11, paddingRight: 31.11, paddingTop: 28.28, paddingBottom: 28.28,
                        background: 'white', boxShadow: '0px 12.726706504821777px 28.281572341918945px rgba(21, 42, 71, 0.08)',
                        borderRadius: 16.97, outline: '0.71px rgba(21, 42, 71, 0.08) solid', outlineOffset: '-0.71px',
                        flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex'
                    }}>

                        {/* Conditionally render the message bubble only when message is not empty */}
                        {message && (
                            <div style={{ alignSelf: 'stretch', paddingTop: 13.25, paddingBottom: 11.75, paddingLeft: 18, paddingRight: 18, background: '#FDECEA', borderRadius: 12, outline: '1px #C0392B solid', outlineOffset: '-1px', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                                <div style={{ justifyContent: 'center', textAlign: 'center', display: 'flex', flexDirection: 'column', color: message.includes('SUCCESS') || message.includes('successful') ? 'green' : '#C0392B', fontSize: 15, fontFamily: 'DM Sans', fontWeight: 'bold', wordWrap: 'break-word' }}>{message}</div>
                            </div>
                        )}

                        <div style={{ alignSelf: 'stretch', paddingBottom: 15, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                        </div>

                        {/* TOP IDENTIFICATION FIELD */}
                        <div style={{ alignSelf: 'stretch', paddingBottom: 15.55, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                <div style={{ alignSelf: 'stretch', paddingBottom: 5.66, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                    <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ alignSelf: 'left', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column', color: '#152A47', fontSize: 14.14, fontFamily: 'League Spartan', fontWeight: '600', wordWrap: 'break-word' }}>
                                            {isRegisterPage ? 'Username' : 'Email'}
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type={isRegisterPage ? "text" : "email"}
                                    aria-label={isRegisterPage ? 'Username' : 'Email'}
                                    value={isRegisterPage ? username : email}
                                    maxLength={50}
                                    onChange={(e) => isRegisterPage ? setUsername(e.target.value) : setEmail(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc',
                                        fontFamily: 'DM Sans', fontWeight: '400', borderRadius: '4px',
                                        alignSelf: 'stretch', height: 39.59, paddingLeft: 15.55, paddingRight: 15.55, background: '#F7F3EA',
                                        borderRadius: 706.33, outline: '0.71px rgba(21, 42, 71, 0.35) solid', outlineOffset: '-0.71px',
                                        justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex', color: '#152A47', fontSize: 16,
                                        wordWrap: 'break-word'
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        {/* REGISTRATION-ONLY EMAIL FIELD */}
                        {isRegisterPage ? (
                            <div style={{ alignSelf: 'stretch', paddingBottom: 15.55, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                    <div style={{ alignSelf: 'stretch', paddingBottom: 5.66, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                            <div style={{ alignSelf: 'left', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column', color: '#152A47', fontSize: 14.14, fontFamily: 'League Spartan', fontWeight: '600', wordWrap: 'break-word' }}>
                                                Email
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="email"
                                        aria-label="Email"
                                        value={email}
                                        maxLength={50}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc',
                                            fontFamily: 'DM Sans', fontWeight: '400', borderRadius: '4px',
                                            alignSelf: 'stretch', height: 39.59, paddingLeft: 15.55, paddingRight: 15.55, background: '#F7F3EA',
                                            borderRadius: 706.33, outline: '0.71px rgba(21, 42, 71, 0.35) solid', outlineOffset: '-0.71px',
                                            justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex', color: '#152A47', fontSize: 16,
                                            wordWrap: 'break-word'
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                        ) : null}

                        {/* PASSWORD FIELD */}
                        <div style={{ alignSelf: 'stretch', paddingBottom: 15.55, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                <div style={{ alignSelf: 'stretch', paddingBottom: 5.66, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                    <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ alignSelf: 'left', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column', color: '#152A47', fontSize: 14.14, fontFamily: 'League Spartan', fontWeight: '600', wordWrap: 'break-word' }}>Password</div>
                                    </div>
                                </div>
                            </div>
                            <input type="password" aria-label="Password" value={password} maxLength={50} onChange={(e) => setPassword(e.target.value)} style={{
                                width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc',
                                fontFamily: 'DM Sans', fontWeight: '400', borderRadius: '4px',
                                alignSelf: 'stretch', height: 39.59, paddingLeft: 15.55, paddingRight: 15.55, background: '#F7F3EA',
                                borderRadius: 706.33, outline: '0.71px rgba(21, 42, 71, 0.35) solid', outlineOffset: '-0.71px',
                                justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex', color: '#152A47', fontSize: 16,
                                fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word'
                            }} required />
                            <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                            </div>
                        </div>

                        {/* C-PASSWORD FIELD */}
                        {isRegisterPage ?
                            <div style={{ alignSelf: 'stretch', paddingBottom: 15.55, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                    <div style={{ alignSelf: 'stretch', paddingBottom: 5.66, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                            <div style={{ alignSelf: 'left', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column', color: '#152A47', fontSize: 14.14, fontFamily: 'League Spartan', fontWeight: '600', wordWrap: 'break-word' }}>Confirm Password</div>
                                        </div>
                                    </div>
                                </div>
                                {/* CHANGED: value and onChange to use confirmPassword */}
                                <input type="password" aria-label="Confirm Password" value={confirmPassword} maxLength={50} onChange={(e) => setConfirmPassword(e.target.value)} style={{
                                    width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc',
                                    fontFamily: 'DM Sans', fontWeight: '400', borderRadius: '4px',
                                    alignSelf: 'stretch', height: 39.59, paddingLeft: 15.55, paddingRight: 15.55, background: '#F7F3EA',
                                    borderRadius: 706.33, outline: '0.71px rgba(21, 42, 71, 0.35) solid', outlineOffset: '-0.71px',
                                    justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex', color: '#152A47', fontSize: 16,
                                    fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word'
                                }} required />
                            </div>
                            : <></>}

                        {/* LOGIN/SIGNUP BUTTON */}
                        <div style={{ alignSelf: 'stretch', justifyContent: 'flex-end', alignItems: 'flex-start', display: 'inline-flex' }}>
                            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                            </div>
                        </div>
                        <div style={{ alignSelf: 'stretch', paddingTop: 21.21, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                            <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex' }}>
                                <button type="submit" style={{ width: 212.11, height: 38.18, background: '#C9A15B', borderRadius: 8.48, justifyContent: 'center', alignItems: 'center', display: 'inline-flex', color: '#152A47', fontSize: 13.43, fontFamily: 'League Spartan', fontWeight: '700', wordWrap: 'break-word' }}>
                                    {isRegisterPage ? 'Sign Up' : 'Log In'}
                                </button>
                            </div>
                        </div>
                        <div style={{ alignSelf: 'stretch', paddingTop: 16.97, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                            <div style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', display: 'inline-flex' }}>
                                <div style={{ alignSelf: 'stretch', paddingRight: 4.24, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', display: 'inline-flex' }}>
                                    <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#152A47', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>{isRegisterPage ? 'Already have an account?' : "Don't have an account?"}</div>
                                    </div>
                                </div>
                                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                                    <a href={isRegisterPage ? "./index.html" : "./register.html"} style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#C9A15B', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>{isRegisterPage ? 'Log in' : 'Sign up'}</a>
                                </div>
                            </div>
                        </div>
                        <div style={{ alignSelf: 'stretch', paddingTop: 8.48, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                            <div style={{ alignSelf: 'stretch', justifyContent: 'center', alignItems: 'flex-start', display: 'inline-flex' }}>
                                <div style={{ alignSelf: 'stretch', paddingRight: 4.24, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', display: 'inline-flex' }}>
                                    <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
                                        <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#6B7A90', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>Are you a property manager?</div>
                                    </div>
                                </div>
                                <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                                    <a href={pathFor('admin-register')} style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#C9A15B', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>Register as a Community Partner</a>
                                </div>
                            </div>
                        </div>


                </form>
            </div>
        </div>
    </div>


            );
}

export default App;
