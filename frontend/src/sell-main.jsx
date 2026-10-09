import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CreateListing from './features/listings/CreateListing.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CreateListing />
  </StrictMode>,
)
