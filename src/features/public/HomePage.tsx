import { Link } from 'react-router-dom'

export function HomePage() {
  return <main className="public-page">
    <div className="ambient ambient-one" aria-hidden="true" />
    <div className="ambient ambient-two" aria-hidden="true" />
    <header className="public-header glass-surface">
      <Link className="wordmark" to="/">vimbre</Link>
      <Link to="/login">Log in</Link>
    </header>
    <section className="hero glass-surface">
      <span className="eyebrow">The record your other tools miss</span>
      <h1 tabIndex={-1}>Stop losing what your team already decided</h1>
      <p>Works next to the tools you already use.</p>
      <Link className="button button-primary" to="/signup">Create your company</Link>
      <p className="muted">Development preview. Capture and handover workflows are coming soon.</p>
    </section>
  </main>
}
