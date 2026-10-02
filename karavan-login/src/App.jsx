import React, { useState, useEffect } from 'react';
import './index.css'
import karavanLogo from './assets/images/logo.png';

function App() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState(''); // NEW
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // NEW
    const [message, setMessage] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // ROUTING CONFIGURATION: Detects if this is the separate register page view
    const isRegisterPage = window.location.pathname.includes('register') || window.location.hash === '#register';

    // Check for an active session right when the page loads
    useEffect(() => {
        const activeSession = localStorage.getItem('service_session_token');
        if (activeSession) {
            setIsLoggedIn(true);
        }
        setIsLoading(false); // Done checking, turn off the loading block
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate that passwords match during registration
        if (isRegisterPage && password !== confirmPassword) {
            setMessage('Error: Passwords do not match.');
            return;
        }

        setMessage(isRegisterPage ? 'Writing to database...' : 'Logging in...');

        // 1. LOCAL MACHINE PREVIEW MODE
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
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
                    const lowerUser = username.toLowerCase();
                    if ((email === 'admin' && password === 'password123') || currentTable.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
                        setIsLoggedIn(true);
                        setMessage('Login successful!');
                        setTimeout(() => {
                            window.location.href = './davidjob/home.html';
                        }, 0);
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
                    setMessage('Account successfully saved! Redirecting to login...');
                    setTimeout(() => {
                        window.location.href = './index.html';
                    }, 1500);
                } else {
                    setIsLoggedIn(true);
                    setMessage('Login successful!');
                    window.location.href = './davidjob/home.html';
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

    // RENDERING THE SEPARATE PAGES
    if (isLoggedIn) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', fontFamily: 'sans-serif', margin: '20px' }}>
                <div style={{ padding: '40px', maxWidth: '350px', width: '100%', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                    <h1 style={{ color: '#333', fontSize: '24px' }}>Welcome back!</h1>
                    <p style={{ color: 'green', fontWeight: 'bold' }}>You are securely logged into the service.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: 1440, height: 1024, background: 'linear-gradient(0deg, white 0%, white 100%), white', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
            <div style={{ alignSelf: 'stretch', height: 74, paddingLeft: 27.67, paddingRight: 27.67, position: 'relative', background: '#F7F3EA', borderBottom: '0.86px rgba(21, 42, 71, 0.10) solid', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex' }}>
                <div style={{ left: 0, top: 4, position: 'absolute', justifyContent: 'flex-start', alignItems: 'center', display: 'flex' }}>
                    <img style={{ width: 60.86, height: 66.67, paddingLeft: 13.83 }} src={karavanLogo} />
                    <div style={{ paddingRight: 20, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
                        <div style={{ width: 266, height: 21, textAlign: 'center', color: '#1F2F46', fontSize: 48, fontFamily: 'League Spartan', fontWeight: '400', wordWrap: 'break-word', letterSpacing: 4}}>KARAVAN</div>
                    </div>
                </div>
            </div>

            <div style={{ alignSelf: 'stretch', height: 1024, position: 'relative', background: '#F7F3EA', overflow: 'hidden', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex' }}>
                <div style={{ width: 1018.14, height: 656.13, paddingLeft: 42.42, paddingRight: 42.42, left: 211, top: 159, position: 'absolute', justifyContent: 'center', alignItems: 'center', display: 'inline-flex' }}>
                    <div style={{ width: 438.36, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', display: 'inline-flex' }}>
                        <img style={{ width: 189.10, height: 207.14 }} src={karavanLogo} />
                        <div style={{ width: 266, height: 54, textAlign: 'center', color: '#1F2F46', fontSize: 48, fontFamily: 'League Spartan', fontWeight: '400', wordWrap: 'break-word', letterSpacing: 4 }}>KARAVAN</div>
                    </div>
               
                    {/*                    {message && (
                    <p style={{ textAlign: 'center', fontWeight: 'bold', color: message.includes('SUCCESS') || message.includes('successful') ? 'green' : 'orange' }}>
                        {message}
                    </p>
                    )}*/}

                    <form onSubmit={handleSubmit} style={{
                        width: 395.94, paddingLeft: 31.11, paddingRight: 31.11, paddingTop: 28.28, paddingBottom: 28.28,
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
                            <input type="password" value={password} maxLength={50} onChange={(e) => setPassword(e.target.value)} style={{
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
                                <input type="password" value={confirmPassword} maxLength={50} onChange={(e) => setConfirmPassword(e.target.value)} style={{
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
                                <div style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#C9A15B', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>Forgot your Password?</div>
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
                                    <a href={"./ayushstuff/#/admin-register"} style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#C9A15B', fontSize: 10.61, fontFamily: 'DM Sans', fontWeight: '400', wordWrap: 'break-word' }}>Register as a Community Partner</a>
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
