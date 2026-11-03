import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Favorites from './Favorites.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <Favorites />
    </RequireLogin>
  </StrictMode>,
)
