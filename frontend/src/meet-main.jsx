import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OrganizeMeet from './OrganizeMeet.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <OrganizeMeet />
    </RequireLogin>
  </StrictMode>,
)
