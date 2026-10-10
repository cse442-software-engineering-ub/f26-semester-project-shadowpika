import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CreateListing from './features/listings/CreateListing.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <CreateListing />
    </RequireLogin>
  </StrictMode>,
)
