import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Settings from './pages/Settings.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <Settings />
    </RequireLogin>
  </StrictMode>,
)
