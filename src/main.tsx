import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@motionstudies/web/tokens.css'
import { App } from './App'
import './style.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
