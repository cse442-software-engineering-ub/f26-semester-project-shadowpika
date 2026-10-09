import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlaceholderPage from './PlaceholderPage.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <PlaceholderPage title="Profile" />
    </RequireLogin>
  </StrictMode>,
)
