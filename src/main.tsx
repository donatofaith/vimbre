import {registerWorkspaceApp} from './features/my-day/install'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/fonts.css'
import { AuthProvider } from './features/auth/AuthProvider'
import { App } from './app/App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './styles/tokens.css'
import './styles/global.css'
import './styles/polish.css'
import './styles/action-colours.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider><App /></AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)


registerWorkspaceApp()
