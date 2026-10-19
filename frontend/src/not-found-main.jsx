import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import NotFound from './NotFound.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NotFound />
  </StrictMode>,
)
