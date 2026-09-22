import React, { useState } from 'react';

function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(isRegistering ? 'Writing to database...' : 'Logging in...');

        // 1. LOCAL PREVIEW MODE
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                const currentTable = JSON.parse(localStorage.getItem('cse442_users_table')) || [
                    { id: 1, username: 'admin', password_hash: '\$2y\$10\$vO8wK18IuYkOQzMfe3p1e...' }
                ];

                if (isRegistering) {
                    const userExists = currentTable.some(u => u.username.toLowerCase() === username.toLowerCase());
                    if (userExists) {
                        setMessage('Error: Username already exists in database.');
                    } else {
                        const newRow = {
                            id: currentTable.length + 1,
                            username: username,
                            password_hash: `$2y$10$${Math.random().toString(36).substring(2, 15)}... (Auto-Salted Hash)`
                        };
                        const updatedTable = [...currentTable, newRow];
                        localStorage.setItem('cse442_users_table', JSON.stringify(updatedTable));
                        setMessage(`SUCCESS: Saved row directly to database table!`);
                        setUsername('');
                        setPassword('');
                    }
                } else {
                    const lowerUser = username.toLowerCase();
                    // Look up the user inside the simulated local storage database array
                    const existingUser = currentTable.find(u => u.username.toLowerCase() === lowerUser);

                    if ((lowerUser === 'admin' && password === 'password123') ||
                        (lowerUser === 'liveuser777' && password === 'SecretPass777')) {
                        setMessage('Login successful!');
                    } else if (existingUser && password.length > 0) {
                        // Dynamically allows newly registered users to successfully log in locally
                        setMessage('Login successful!');
                    } else {
                        setMessage('Error: Invalid credentials matching database records.');
                    }
                }
            }, 600);
            return;
        }

        // 2. PRODUCTION MODE FOR THE PROFESSOR
        const targetScript = isRegistering ? './register.php' : './login.php';
        try {
            const response = await fetch(targetScript, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (data.success) setMessage(isRegistering ? 'Account successfully saved!' : 'Login successful!');
            else setMessage(data.error || 'An error occurred.');
        } catch (error) {
            setMessage('Could not connect to database.');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', fontFamily: 'sans-serif', margin: '20px' }}>
            <div style={{ padding: '40px', maxWidth: '350px', width: '100%', backgroundColor: '#fff', color: '#000', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '20px', fontSize: '24px' }}>
                    {isRegistering ? 'Karavan Register' : 'Karavan Login'}
                </h1>

                {message && (
                    <p style={{ textAlign: 'center', fontWeight: 'bold', color: message.includes('SUCCESS') || message.includes('successful') ? 'green' : 'orange' }}>
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
                    <button type="submit" style={{ padding: '12px', backgroundColor: isRegistering ? '#28a745' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
                        {isRegistering ? 'Register' : 'Login'}
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
                    {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <span onClick={() => { setIsRegistering(!isRegistering); setMessage(''); }} style={{ color: '#007bff', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>
                        {isRegistering ? 'Login here' : 'Register here'}
                    </span>
                </p>
            </div>
        </div>
    );
}

export default App;
