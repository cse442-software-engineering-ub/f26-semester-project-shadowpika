import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ProductSearch from './ProductSearch.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProductSearch />
  </StrictMode>,
)
