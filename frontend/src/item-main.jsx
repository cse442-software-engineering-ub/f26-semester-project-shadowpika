import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ItemDetails from './ItemDetails.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <ItemDetails />
    </RequireLogin>
  </StrictMode>,
)
