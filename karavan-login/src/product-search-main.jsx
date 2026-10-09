import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ProductSearch from './ProductSearch.jsx'
import RequireLogin from './components/RequireLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RequireLogin>
      <ProductSearch />
    </RequireLogin>
  </StrictMode>,
)
