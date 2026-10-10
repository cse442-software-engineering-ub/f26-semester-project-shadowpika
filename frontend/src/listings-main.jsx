import React from 'react';
import ReactDOM from 'react-dom/client';
import ManageListings from './ManageListings.jsx';
import RequireLogin from './components/RequireLogin.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <RequireLogin>
        <ManageListings />
    </RequireLogin>
);
