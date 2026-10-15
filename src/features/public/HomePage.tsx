import { Link } from 'react-router-dom'
export function HomePage() {
  return <main className="public-page"><header className="public-header"><Link className="wordmark" to="/">vimbre</Link><Link to="/app">View workspace foundation</Link></header><section className="hero"><span className="eyebrow">The record your other tools miss</span><h1 tabIndex={-1}>Stop losing what your team already decided</h1><p>Works next to the tools you already use.</p><Link className="button button-primary" to="/app">View workspace foundation</Link><p className="muted">Development foundation. Accounts and product features are coming soon.</p></section></main>
}
