import React from 'react';
import ReactDOM from 'react-dom/client';
import ManageListings from './ManageListings.jsx';

// Mount your dashboard natively without the development strict mode wrapper block
ReactDOM.createRoot(document.getElementById('root')).render(
    <ManageListings />
);
