const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } }); await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles' }); page.setDefaultTimeout(10000);
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00Z'));
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'capture@example.invalid', role: 'authenticated', aud: 'authenticated', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
    const company = { id: '22222222-2222-4222-8222-222222222222', name: 'Capture fixture', team_mode: 'small' };
    const profile = { id: user.id, company_id: company.id, full_name: 'Capture Owner', email: user.email, active: true, role: 'employee', department_id: null };
    const sources = [], drafts = []; let failConfirm = false;
    await page.route('https://*.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url()); let args = {}; try { args = request.postDataJSON() || {}; } catch {}
      let body = {}, status = 200;
      if (url.pathname.endsWith('/token')) body = { access_token: 'capture-test-token', refresh_token: 'capture-test-refresh', token_type: 'bearer', expires_in: 3600, user };
      else if (url.pathname.endsWith('/user')) body = user;
      else if (url.pathname.endsWith('/profiles')) body = profile;
      else if (url.pathname.endsWith('/companies')) body = company;
      else if (url.pathname.endsWith('/my_invitation')) body = [];
      else if (url.pathname.endsWith('/my_day_summary')) body = { pending_drafts: drafts.filter(d => d.status === 'pending').length, completed_sections: [], forwarding_address: null };
      else if (url.pathname.endsWith('/actions')) body = [];
      else if (url.pathname.endsWith('/capture_list')) { const rows = sources.filter(s => Boolean(s.deleted_at) === args.p_archived); body = { rows, count: rows.length }; }
      else if (url.pathname.endsWith('/capture_detail')) { const source = sources.find(s => s.id === args.p_id); body = source ? { source, items: drafts.filter(d => d.capture_id === source.id) } : null; }
      else if (url.pathname.endsWith('/capture_change')) {
        if (args.p_operation === 'create') { sources.push({ id: args.p_id, ...args.p_data, deleted_at: null }); body = args.p_id; }
        else if (args.p_operation === 'add') { drafts.push({ id: args.p_id, capture_id: args.p_capture, payload: args.p_data, kind: args.p_data.kind, version: 1, status: 'pending' }); body = args.p_id; }
        else if (args.p_operation === 'confirm' && failConfirm) { status = 500; body = { message: 'Test confirm failure' }; }
        else if (['confirm', 'discard'].includes(args.p_operation)) { const d = drafts.find(d => d.id === args.p_id); assert.equal(d.version, args.p_data.version); d.status = args.p_operation === 'confirm' ? 'confirmed' : 'discarded'; d.version++; body = d.id; }
        else if (args.p_operation === 'edit') { const d = drafts.find(d => d.id === args.p_id); d.payload = args.p_data; d.version++; body = d.id; }
        else if (['archive', 'restore'].includes(args.p_operation)) { const s = sources.find(s => s.id === args.p_id); s.deleted_at = args.p_operation === 'archive' ? new Date().toISOString() : null; body = s.id; }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:5173/'); await page.getByRole('link', { name: 'Log in', exact: true }).click();
    await page.getByLabel('Work email').fill(user.email); await page.getByLabel('Password', { exact: true }).fill('capture-test-password'); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor();
    await page.getByRole('heading',{name:'Good morning, Capture',exact:true}).waitFor();
    await page.getByRole('link', { name: 'Back to website', exact: true }).click(); await page.getByRole('link', { name: 'Open workspace', exact: true }).first().waitFor(); assert.equal(await page.getByRole('link', { name: 'Log in', exact: true }).count(), 0);
    await page.reload(); await page.getByRole('link', { name: 'Open workspace', exact: true }).first().click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert.equal(new URL(page.url()).pathname, '/app');
    await page.getByRole('link', { name: 'Capture an email or notes', exact: true }).click(); await page.getByRole('heading', { name: 'Save what your team decided', exact: true }).waitFor();
    await page.getByText('Forward an email, paste notes or upload a file. Vimbre drafts the decisions and tasks for you to confirm.', { exact: true }).waitFor();
    await page.getByText('AI drafting · Coming soon', { exact: true }).waitFor(); await page.getByRole('link', { name: 'My role', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Nothing is saved until you confirm it.', exact: true }).waitFor();
    await page.getByLabel('Source title (optional)').fill('Operations update'); await page.getByLabel('Source date').fill('2026-10-16'); await page.getByLabel('Notes or email text').fill('Private original notes. Finance approved the Friday reporting deadline.'); await page.getByRole('button', { name: 'Save source & review', exact: true }).click();
    await page.getByRole('heading', { name: 'Operations update', exact: true }).waitFor(); assert((await page.getByRole('button', { name: 'Add draft manually', exact: true }).getAttribute('class')).includes('button-secondary'));
    assert.equal(await page.getByRole('button', { name: 'Archive', exact: true }).getAttribute('title'), 'You can find it later'); await page.getByText('Read the original email or notes', { exact: true }).click(); await page.getByText('Private original notes. Finance approved the Friday reporting deadline.', { exact: true }).waitFor();
    assert.equal(await page.getByText('Read your source, then add a decision, task or external contact to review.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Add draft manually', exact: true }).click(); await page.getByLabel('Title', { exact: true }).fill('Send the weekly report'); await page.getByLabel('Why was it decided?').fill('Finance needs the figures before Monday.'); await page.getByLabel('Who decided?', { exact: true }).fill('Finance'); await page.getByLabel('Decision date').fill('2026-10-16'); await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const pending = page.getByRole('list', { name: 'Drafts to review', exact: true }); await pending.getByRole('heading', { name: 'Send the weekly report', exact: true }).waitFor(); await pending.getByText('Decided by Finance · 16 Oct 2026', { exact: true }).waitFor();
    failConfirm = true; await pending.getByRole('button', { name: 'Confirm decision', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor(); assert.equal(drafts[0].status, 'pending'); failConfirm = false;
    await pending.getByRole('button', { name: 'Confirm decision', exact: true }).click();
    const saved = page.getByRole('list', { name: 'Saved records', exact: true }); await saved.getByRole('heading', { name: 'Send the weekly report', exact: true }).waitFor(); assert.equal(await pending.count(), 0); await page.getByRole('heading', { name: 'No drafts to review', exact: true }).waitFor(); assert.equal(await saved.getByRole('link', { name: 'Open in My role', exact: true }).getAttribute('href'), '/app/role-record?section=decision');
    await page.reload(); await saved.getByRole('heading', { name: 'Send the weekly report', exact: true }).waitFor(); assert.equal(await pending.count(), 0);
    for (const width of [320, 360, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `Capture overflow at ${width}`); }
    assert.equal(errors.length, 0, JSON.stringify(errors)); console.log(JSON.stringify({ signedInReturnAndReload: 'passed', captureClientCopy: 'passed', manualEntrySecondary: 'passed', failedConfirmKeepsDraft: 'passed', confirmedMovesToSaved: 'passed', formattedDateAcrossTimezones: 'passed', mobileAndDesktopOverflow: false, pageErrors: errors, network: 'mocked; no real user data or email' }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
