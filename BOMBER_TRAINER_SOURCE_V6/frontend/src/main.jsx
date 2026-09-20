import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'

function removeExternalOverlays() {
  const clean = () => {
    document.body?.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'root') {
        node.remove()
      }
    })
    document.querySelectorAll('iframe, object, embed').forEach((node) => {
      if (!node.closest('#root')) node.remove()
    })
  }

  clean()
  const observer = new MutationObserver(clean)
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

class BootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('BOMBER TRAINER boot/render error', error, info)
  }

  render() {
    if (this.state.error) {
      const error = this.state.error
      return (
        <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
          <div style={{ maxWidth: '720px', margin: '40px auto', background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,.08)' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>BOMBER TRAINER — error d’arrencada</h1>
            <p style={{ marginTop: '12px', color: '#475569' }}>L’app no ha pogut carregar una part del programa. Aquest missatge ens permet identificar exactament quin error està provocant la pantalla blanca.</p>
            <pre style={{ marginTop: '16px', padding: '16px', overflow: 'auto', whiteSpace: 'pre-wrap', background: '#f1f5f9', borderRadius: '12px', fontSize: '13px' }}>{String(error?.stack || error?.message || error)}</pre>
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: '16px', minHeight: '48px', padding: '0 18px', border: 0, borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 800 }}>Tornar a carregar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function Boot() {
  const [App, setApp] = React.useState(null)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    import('./App.jsx')
      .then((module) => setApp(() => module.default))
      .catch((err) => {
        console.error('BOMBER TRAINER module load error', err)
        setError(err)
      })
  }, [])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
        <div style={{ maxWidth: '720px', margin: '40px auto', background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,.08)' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>BOMBER TRAINER — error de càrrega</h1>
          <p style={{ marginTop: '12px', color: '#475569' }}>La pantalla blanca estava amagant un error de JavaScript. Ara ja el podem veure.</p>
          <pre style={{ marginTop: '16px', padding: '16px', overflow: 'auto', whiteSpace: 'pre-wrap', background: '#f1f5f9', borderRadius: '12px', fontSize: '13px' }}>{String(error?.stack || error?.message || error)}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: '16px', minHeight: '48px', padding: '0 18px', border: 0, borderRadius: '12px', background: '#0f172a', color: 'white', fontWeight: 800 }}>Tornar a carregar</button>
        </div>
      </div>
    )
  }

  if (!App) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', color: '#475569' }}>Carregant BOMBER TRAINER…</div>
  }

  return <BootErrorBoundary><App /></BootErrorBoundary>
}

ReactDOM.createRoot(document.getElementById('root')).render(<Boot />)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', removeExternalOverlays, { once: true })
} else {
  removeExternalOverlays()
}

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
