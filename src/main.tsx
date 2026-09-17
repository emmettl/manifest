import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@motionstudies/web/tokens.css'
import { App } from './App'
import './style.css'

async function mount() {
  const Component = import.meta.env.DEV && new URLSearchParams(window.location.search).get('study') === 'portwatch'
    ? (await import('./PortwatchApp')).PortwatchApp
    : App
  createRoot(document.getElementById('root')!).render(<StrictMode><Component /></StrictMode>)
}
void mount()
