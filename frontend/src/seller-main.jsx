import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SellerProfile from './SellerProfile.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <SellerProfile />
    </RequireLogin>
  </StrictMode>,
)
