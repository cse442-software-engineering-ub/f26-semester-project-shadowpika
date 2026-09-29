import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PlaceholderPage from './PlaceholderPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PlaceholderPage title="Home" />
  </StrictMode>,
)
