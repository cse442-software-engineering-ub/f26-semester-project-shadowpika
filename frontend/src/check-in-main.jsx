import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CheckIn from './CheckIn.jsx';
import RequireLogin from './components/RequireLogin.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><RequireLogin><CheckIn /></RequireLogin></StrictMode>);
