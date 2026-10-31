import { CaptureSourceLogo } from '../capture/CaptureSourceLogo'

/** Public illustration of the shipped workflow. Sample data only; no workspace requests. */
export function ProductWalkthroughScreen({ step }: { step: number }) {
  return <div className="rf-current-product" aria-label="Vimbre workflow example">
    <div className="rf-current-heading"><strong>{step === 3 ? 'Handovers' : 'Capture'}</strong><small>Example · Sample data</small></div>
    {step === 0 ? <>
      <h3>Bring in a conversation</h3>
      <div className="rf-current-tabs"><span>Paste</span>{[['teams','Teams'],['outlook','Outlook']].map(([provider,name])=><span key={provider}><CaptureSourceLogo provider={provider}/>{name}</span>)}<span>Upload</span></div>
      <p className="rf-current-label">Paste the conversation.</p>
      <blockquote>Alex: I’ll send the revised supplier quote by 12 Nov 2026.<br/><br/>Sam: I’ll arrange the review for 16 Nov 2026. We agreed to review suppliers monthly.</blockquote>
      <div className="rf-current-controls"><span className="rf-current-primary">Draft tasks and decisions</span><span>Add manually</span></div>
    </> : step < 3 ? <>
      <h3>Supplier review</h3><p className="rf-current-muted">{step === 1 ? 'Needs review' : '2 drafts accepted'}</p>
      <article><span className="rf-current-chip">Task</span><h4>Send the revised supplier quote</h4><p>Owner: Alex · Due 12 Nov 2026</p><div className="rf-current-controls"><span>{step === 1 ? 'Accept' : 'Accepted ✓'}</span><span>Edit</span><span>Dismiss</span></div></article>
      <article><span className="rf-current-chip">Decision</span><h4>Review suppliers monthly</h4><p>Reduce meetings and keep the review notes together.</p><div className="rf-current-controls"><span>{step === 1 ? 'Accept' : 'Accepted ✓'}</span><span>Edit</span><span>Dismiss</span></div></article>
      <div className="rf-current-controls"><span className="rf-current-primary">Save {step === 1 ? '0' : '2'} drafts</span><span>Discard</span></div>
    </> : <>
      <h3>Supplier review handover</h3><p className="rf-current-muted">Details → Include → Draft → Send</p>
      <article><h4>Cover person</h4><p>Sam · 12–20 Nov 2026</p></article>
      <article><h4>What comes first</h4><p>Send the revised supplier quote by 12 Nov. Keep the monthly review decision with the handover.</p></article>
      <p className="rf-current-muted">Review the selected work and send it to your manager.</p>
      <div className="rf-current-controls"><span>Back</span><span className="rf-current-primary">Submit to manager</span></div>
    </>}
  </div>
}
