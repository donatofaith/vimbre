import './contact.css'

export function ContactSection() {
  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="rs-container contact-layout">
        <div className="contact-intro">
          <span className="rs-eyebrow">Get in touch</span>
          <h2 id="contact-title" tabIndex={-1}>How can we help?</h2>
        </div>
        <div className="contact-grid">
          <div className="contact-card">
            <h3>Support</h3>
            <p>Help with your account or workspace.</p>
            <a href="mailto:support@vimbre.com?subject=Vimbre%20support">support@vimbre.com<span aria-hidden="true"> ↗</span></a>
          </div>
          <div className="contact-card">
            <h3>General enquiries</h3>
            <p>Questions about Vimbre, plans or partnerships.</p>
            <a href="mailto:hello@vimbre.com?subject=Vimbre%20enquiry">hello@vimbre.com<span aria-hidden="true"> ↗</span></a>
          </div>
        </div>
      </div>
    </section>
  )
}
