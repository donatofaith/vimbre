const consoleUrl = 'https://admin.vimbre.com/careers'

export function careersEmail(kind: 'staff' | 'applicant', applicantEmail?: string) {
  const applicant = kind === 'applicant'
  if (applicant && !applicantEmail) throw new Error('Missing applicant recipient')

  const subject = applicant ? 'We received your application | Vimbre' : 'New application | Vimbre Careers'
  const heading = applicant ? 'Application received' : 'New careers application'
  const message = applicant
    ? 'Thank you for applying to Vimbre. We’ve received your application.'
    : 'A new application is ready for you to review in the Console.'
  const action = applicant ? '' : `<p style="margin:24px 0 0"><a href="${consoleUrl}" style="display:inline-block;background:#2058be;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 20px;font-weight:bold">Review application</a></p>`
  const htmlContent = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;background:#f1f5fb;color:#102a43;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5fb"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dbe4ef;border-radius:14px">
<tr><td style="padding:24px 26px 18px;border-bottom:1px solid #e3ebf3;color:#102a43;font-size:20px;font-weight:bold">Vimbre <span style="font-size:13px;color:#526579;font-weight:normal"> · Careers</span></td></tr>
<tr><td style="padding:26px"><h1 style="margin:0 0 14px;font-size:27px;line-height:1.2">${heading}</h1><p style="margin:0;color:#40566b;font-size:16px;line-height:1.55">${message}</p>${action}${applicant ? '<p style="margin:20px 0 0;font-size:15px">The Vimbre team</p>' : ''}</td></tr>
</table></td></tr></table></body></html>`
  const textContent = applicant
    ? `${message}\n\nThe Vimbre team`
    : `${message}\n\nReview application: ${consoleUrl}`
  return {
    to: [{email: applicant ? applicantEmail! : 'hellovimbre@gmail.com'}],
    subject,
    textContent,
    htmlContent,
  }
}
