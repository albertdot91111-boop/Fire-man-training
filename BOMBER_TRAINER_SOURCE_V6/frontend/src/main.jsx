import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Bomber Trainer only needs #root in document.body. Remove any third-party
// floating overlays injected outside the app (for example video/ad widgets).
function removeExternalOverlays() {
  const clean = () => {
    document.body?.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'root') {
        node.remove()
      }
    })
  }
  clean()
  const observer = new MutationObserver(clean)
  observer.observe(document.body, { childList: true })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', removeExternalOverlays, { once: true })
} else {
  removeExternalOverlays()
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  })
}
