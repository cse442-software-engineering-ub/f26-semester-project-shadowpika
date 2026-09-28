import React, { useState } from 'react';

// Hard-coded demo account, accepted in addition to the normal login checks.
const DEMO_EMAIL = 'chun.buyer@test.com';
const DEMO_PASSWORD = 'Buyer123!';

function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const loginSuccess = () => {
        setMessage('Login successful!');
        window.location.href = './product-search.html';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('Logging in...');

        const lowerUser = username.trim().toLowerCase();
        const isDemoAccount = lowerUser === DEMO_EMAIL && password === DEMO_PASSWORD;

        // 1. LOCAL PREVIEW MODE
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                const currentTable = JSON.parse(localStorage.getItem('cse442_users_table')) || [
                    { id: 1, username: 'admin', password_hash: '\$2y\$10\$vO8wK18IuYkOQzMfe3p1e...' }
                ];

                // Look up the user inside the simulated local storage database array
                const existingUser = currentTable.find(u => u.username.toLowerCase() === lowerUser);

                if (isDemoAccount ||
                    (lowerUser === 'admin' && password === 'password123') ||
                    (lowerUser === 'liveuser777' && password === 'SecretPass777')) {
                    loginSuccess();
                } else if (existingUser && password.length > 0) {
                    loginSuccess();
                } else {
                    setMessage('Error: Invalid credentials matching database records.');
                }
            }, 600);
            return;
        }

        // 2. PRODUCTION MODE FOR THE PROFESSOR
        if (isDemoAccount) {
            loginSuccess();
            return;
        }
        try {
            const response = await fetch('./login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (data.success) loginSuccess();
            else setMessage(data.error || 'An error occurred.');
        } catch (error) {
            setMessage('Could not connect to database.');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', fontFamily: 'sans-serif', margin: '20px' }}>
            <div style={{ padding: '40px', maxWidth: '350px', width: '100%', backgroundColor: '#fff', color: '#000', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '20px', fontSize: '24px' }}>
                    Karavan Login
                </h1>

                {message && (
                    <p style={{ textAlign: 'center', fontWeight: 'bold', color: message.includes('successful') ? 'green' : 'orange' }}>
                        {message}
                    </p>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Username:</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} required />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>Password:</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} required />
                    </div>
                    <button type="submit" style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
}

export default App;
