import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ItemDetails from './ItemDetails.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ItemDetails />
  </StrictMode>,
)
