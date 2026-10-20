import { WebsiteHeader } from './WebsiteHeader'
import './landing.css'
import './contact.css'

export function ContactPage() {
  return (
    <div className="rs-site contact-site" data-theme="light">
      <a className="skip-link" href="#contact-main">Skip to content</a>
      <WebsiteHeader />
      <main id="contact-main" className="contact-main rs-container">
        <div className="contact-intro">
          <span className="rs-eyebrow">Get in touch</span>
          <h1 tabIndex={-1}>Contact Vimbre</h1>
          <p>How can we help?</p>
        </div>
        <div className="contact-grid">
          <section className="contact-card contact-support" aria-labelledby="contact-support-title">
            <span className="contact-symbol" aria-hidden="true">↗</span>
            <h2 id="contact-support-title">Support</h2>
            <p>Help with your account or workspace.</p>
            <a href="mailto:support@vimbre.com?subject=Vimbre%20support">support@vimbre.com<span aria-hidden="true"> ↗</span></a>
          </section>
          <section className="contact-card" aria-labelledby="contact-enquiries-title">
            <span className="contact-symbol" aria-hidden="true">↗</span>
            <h2 id="contact-enquiries-title">General enquiries</h2>
            <p>Questions about Vimbre, plans or partnerships.</p>
            <a href="mailto:hello@vimbre.com?subject=Vimbre%20enquiry">hello@vimbre.com<span aria-hidden="true"> ↗</span></a>
          </section>
        </div>
      </main>
      <footer className="rs-footer rs-container">© 2026 Vimbre.</footer>
    </div>
  )
}
