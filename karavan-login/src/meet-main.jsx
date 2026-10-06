import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OrganizeMeet from './OrganizeMeet.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OrganizeMeet />
  </StrictMode>,
)
