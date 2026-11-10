import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Messages from './Messages.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <Messages />
    </RequireLogin>
  </StrictMode>,
)
