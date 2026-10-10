import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Home from './Home.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <Home />
    </RequireLogin>
  </StrictMode>,
)
