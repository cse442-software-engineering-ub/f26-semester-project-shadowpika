import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminRegister from './pages/AdminRegister.jsx'
import ModeratorDashboard from './pages/ModeratorDashboard.jsx'
import RequireLogin from './components/RequireLogin.jsx'
import { currentRoute } from './routes.js'

const PAGES = {
  'admin-register': AdminRegister,
  moderator: () => (
    <RequireLogin>
      <ModeratorDashboard />
    </RequireLogin>
  ),
  login: App,
}

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

function render() {
  const route = currentRoute()
  const Page = PAGES[route]
  rootElement.classList.toggle('kv-root', route !== 'login')
  root.render(
    <StrictMode>
      <Page key={route} />
    </StrictMode>,
  )
}

window.addEventListener('hashchange', render)
render()
