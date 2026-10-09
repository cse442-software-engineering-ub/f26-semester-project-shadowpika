import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import NavBar from './NavBar.jsx'
import navBarCss from './NavBar.css?inline'
import communityPickerCss from './components/CommunityPicker.css?inline'

// Standalone navbar for the static settings/ pages, built as assets/navbar.js.
// Those pages aren't Vite-built HTML, so nothing links the stylesheet or fonts for them.
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=League+Spartan:wght@400;600;700&display=swap'

if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
  const fonts = document.createElement('link')
  fonts.rel = 'stylesheet'
  fonts.href = FONTS_HREF
  document.head.append(fonts)
}

const styles = document.createElement('style')
styles.textContent = navBarCss + communityPickerCss
document.head.append(styles)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NavBar />
  </StrictMode>,
)
