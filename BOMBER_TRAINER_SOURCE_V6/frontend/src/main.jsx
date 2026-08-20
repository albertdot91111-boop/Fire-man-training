import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Bomber Trainer only needs the React app inside #root.
// Remove floating third-party/old widgets that may be injected outside the app.
function removeExternalOverlays() {
  const clean = () => {
    document.body?.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'root') {
        node.remove()
      }
    })

    // Also remove common floating embed/widget elements if an old script
    // manages to place them back inside the document.
    document.querySelectorAll('iframe, object, embed').forEach((node) => {
      if (!node.closest('#root')) node.remove()
    })
  }

  clean()
  const observer = new MutationObserver(clean)
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', removeExternalOverlays, { once: true })
} else {
  removeExternalOverlays()
}

// Remove stale service workers from older builds so an obsolete overlay/button
// cannot be restored from a previous application version.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
      const cacheKeys = await caches.keys()
      await Promise.all(cacheKeys.map((key) => caches.delete(key)))
    } catch (_) {}
  })
}
