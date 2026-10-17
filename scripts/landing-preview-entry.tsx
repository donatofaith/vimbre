import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../src/features/auth/AuthProvider'
import { HomePage } from '../src/features/public/HomePage'

export function renderLanding() {
  return renderToStaticMarkup(<MemoryRouter><AuthProvider><HomePage /></AuthProvider></MemoryRouter>)
}
