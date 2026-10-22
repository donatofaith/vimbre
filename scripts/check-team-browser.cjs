const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'admin@example.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
    const company = { id: '22222222-2222-4222-8222-222222222222', name: 'Team test company', team_mode: 'small', contact_email: user.email, created_by: user.id };
    let profile = { id: user.id, full_name: 'Test Admin', company_id: company.id, email: user.email, role: 'hr_admin', department_id: null, active: true };
    const departments = [], invitations = [], requests = [];
    let pending = null, duplicateEmail = false;
    const route = async route => {
      const req = route.request(), url = new URL(req.url()); let args = null;
      try { args = req.postDataJSON(); } catch {}
      requests.push({ path: url.pathname, args });
      let body = {}, status = 200;
      if (url.pathname.endsWith('/token')) body = { access_token: 'browser-token', refresh_token: 'browser-refresh', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname.endsWith('/user')) body = user;
      else if (url.pathname.endsWith('/company_active_member_count')) body = 2;
      else if (url.pathname.endsWith('/work_notification_inbox')) body={unread:0,count:0,items:[]};
      else if(url.pathname.endsWith('/myday_alerts'))body=[];
      else if(url.pathname.endsWith('/myday_preferences'))body={timezone:'Europe/London',reminder_time:'09:00',email_enabled:true,email_delivery_ready:false};
      else if(url.pathname.endsWith('/myday_notes'))body={rows:[],count:0};
      else if(url.pathname.endsWith('/myday_tasks'))body={rows:[],count:0,today:'2026-10-22',timezone:'Europe/London',counts:{todo:0,progress:0,overdue:0},has_work:false,context_waiting:[]};
      else if(url.pathname.endsWith('/myday_valid_recurrence'))body=true;
      else if (url.pathname.endsWith('/my_day_summary')) body = { pending_drafts: 0, completed_sections: [], forwarding_address: null };
      else if (url.pathname.endsWith('/my_invitation')) body = pending ? [pending] : [];
      else if (url.pathname.endsWith('/companies')) body = company;
      else if (url.pathname.endsWith('/profiles')) {
        const row = { ...profile, department: departments.find(row => row.id === profile.department_id) ?? null };
        body = req.headers().accept?.includes('vnd.pgrst.object') ? row : [row];
      } else if (url.pathname.endsWith('/departments')) body = departments.filter(row => !row.archived_at).map(row => ({ ...row, manager: row.manager_id ? { full_name: profile.full_name } : null }));
      else if (url.pathname.endsWith('/invitations')) body = invitations.map(row => ({ ...row, department: departments.find(dept => dept.id === row.department_id) ?? null }));
      else if (url.pathname.endsWith('/manage_department')) {
        if (!args.p_id) { const row = { id: '33333333-3333-4333-8333-333333333333', company_id: company.id, name: args.p_name, manager_id: null, archived_at: null }; departments.push(row); body = row.id; }
        else { const row = departments.find(row => row.id === args.p_id); if (args.p_archive) row.archived_at = new Date().toISOString(); else { row.name = args.p_name; row.manager_id = args.p_manager; } body = row.id; }
      } else if (url.pathname.endsWith('/manage_member_context')) { profile = { ...profile, full_name: args.p_full_name, department_id: args.p_department, role: args.p_role, active: args.p_active, role_description: args.p_description, role_start_date: args.p_start }; body = null; }
      else if (url.pathname.endsWith('/team-invitations') && duplicateEmail) { status=400;body={error:'This email already belongs to a workspace. Existing members can be managed on the Team page'}; }
      else if (url.pathname.endsWith('/team-invitations')) {
        if (args.action === 'create') invitations.push({ id: '44444444-4444-4444-8444-444444444444', company_id: company.id, email: args.email, full_name: args.full_name, role: args.role, department_id: args.department_id, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date().toISOString() });
        body = { invitation_id: invitations[0].id, delivery: 'accepted' };
      } else if (url.pathname.endsWith('/cancel_invitation')) { invitations.find(row => row.id === args.p_id).status = 'cancelled'; body = null; }
      else if (url.pathname.endsWith('/accept_invitation')) { pending = null; profile.active = true; body = null; }
      const headers = Array.isArray(body) ? { 'content-range': body.length ? `0-${body.length - 1}/${body.length}` : '*/0' } : {};
      await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    };
    await page.route('https://*.supabase.co/**', route);
    await page.goto('http://127.0.0.1:5173/login'); await page.getByLabel('Work email').fill(user.email); await page.getByLabel('Password', { exact: true }).fill('browser-test-password'); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor();
    await page.getByRole('link', { name: 'Departments', exact: true }).click(); await page.getByRole('heading', { name: 'Departments', exact: true }).waitFor();
    await page.getByLabel('Department name').fill('Operations'); await page.getByRole('button', { name: 'Create department' }).click(); await page.getByRole('status').filter({ hasText: 'Department created' }).waitFor();
    await page.getByRole('button', { name: 'Edit Operations' }).click(); await page.getByRole('heading', { name: 'Edit Operations' }).waitFor(); await page.getByLabel('Department manager', { exact: true }).selectOption(user.id); await page.getByRole('button', { name: 'Save department' }).click(); await page.getByRole('status').filter({ hasText: 'Department updated' }).waitFor(); assert.equal(departments[0].manager_id, user.id);
    await page.getByRole('link', { name: 'Team', exact: true }).click(); await page.getByRole('heading', { name: 'Team', exact: true }).waitFor();
    duplicateEmail=true;await page.getByLabel('Full name',{exact:true}).fill('Existing member');await page.getByLabel('Email address',{exact:true}).fill(user.email);await page.getByRole('button',{name:'Send invitation',exact:true}).click();
    const duplicate=page.getByRole('alert').filter({hasText:'This email already belongs to a workspace.'});await duplicate.waitFor();assert.equal(await duplicate.evaluate(el=>getComputedStyle(el).color),'rgb(180, 35, 24)');duplicateEmail=false;
    await page.getByLabel('Full name', { exact: true }).fill('New Teammate'); await page.getByLabel('Email address', { exact: true }).fill('teammate@example.invalid'); await page.getByLabel('Department (optional)', { exact: true }).selectOption(departments[0].id); await page.getByRole('button', { name: 'Send invitation' }).click(); await page.getByRole('status').filter({ hasText: 'Invitation email requested' }).waitFor(); assert.equal(invitations[0].department_id, departments[0].id);
    await page.getByRole('button', { name: 'Resend to New Teammate' }).click(); await page.getByRole('status').filter({ hasText: 'Invitation email requested' }).waitFor(); assert(requests.some(row => row.path.endsWith('/team-invitations') && row.args.action === 'resend'));
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Cancel invitation for New Teammate' }).click(); await page.getByRole('status').filter({ hasText: 'Invitation cancelled' }).waitFor(); await page.getByText('cancelled', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Test Admin', exact: true }).click(); const editor = page.getByRole('region', { name: 'Edit member' }); await editor.getByLabel('Full name', { exact: true }).fill('Updated Admin'); await editor.getByRole('button', { name: 'Save member' }).click(); await page.getByRole('status').filter({ hasText: 'Member updated' }).waitFor(); assert.equal(profile.full_name, 'Updated Admin');
    await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Company settings',exact:true}).waitFor();
    assert(await page.getByLabel('Account email',{exact:true}).evaluate(el=>el.readOnly));assert.equal(await page.getByLabel('Account email',{exact:true}).inputValue(),user.email);
    assert(await page.getByLabel('Company contact email',{exact:true}).evaluate(el=>el.readOnly));assert(await page.getByLabel('Team structure',{exact:true}).evaluate(el=>el.readOnly));
    assert.equal(await page.getByRole('link',{name:'view plans and subscribe',exact:true}).getAttribute('href'),'/#pricing');
    await page.getByLabel('Company name',{exact:true}).fill('Team test company');await page.getByRole('button',{name:'Save settings',exact:true}).click();await page.getByRole('status').filter({hasText:'Company settings saved.'}).waitFor();
    const settingsWrite=requests.filter(row=>row.path.endsWith('/companies')&&row.args).at(-1);assert.deepEqual(Object.keys(settingsWrite.args),['name']);
    await page.getByRole('link',{name:'Team',exact:true}).click();
    await page.setViewportSize({ width: 360, height: 800 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await page.screenshot({ path: process.env.VIMBRE_TEAM_SCREENSHOT || '/tmp/vimbre-team-mobile.png', fullPage: true });
    // A different browser accepts a valid implicit email link. No metadata grants access.
    Object.assign(user, { id: '55555555-5555-4555-8555-555555555555', email: 'teammate@example.invalid', user_metadata: {} });
    profile = { ...profile, id: user.id, full_name: 'New Teammate', email: user.email, role: 'employee', active: false, department_id: departments[0].id };
    pending = { invitation_id: '66666666-6666-4666-8666-666666666666', company_name: company.name, full_name: profile.full_name, role: 'employee', department_name: 'Operations', expires_at: new Date(Date.now() + 86400000).toISOString() };
    const recipient = await browser.newContext(); const invitePage = await recipient.newPage(); invitePage.setDefaultTimeout(10000); invitePage.on('pageerror', error => errors.push(error.message)); await invitePage.route('https://*.supabase.co/**', route);
    await invitePage.goto('http://127.0.0.1:5173/auth/callback#access_token=browser-invite-token&refresh_token=browser-invite-refresh&expires_in=3600&token_type=bearer&type=magiclink'); await invitePage.getByRole('heading', { name: `Join ${company.name}`, exact: true }).waitFor(); await invitePage.getByLabel('New password', { exact: true }).fill('new-teammate-password'); await invitePage.getByLabel('Confirm password', { exact: true }).fill('new-teammate-password'); await invitePage.getByRole('button', { name: 'Accept invitation' }).click(); await invitePage.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert(profile.active);
    await invitePage.goto('http://127.0.0.1:5173/app/team'); await invitePage.getByRole('heading', { name: 'Team', exact: true }).waitFor(); assert.equal(await invitePage.getByRole('button', { name: 'Send invitation' }).count(), 0); assert.equal(await invitePage.getByRole('button', { name: /Edit New Teammate/ }).count(), 0);
    assert.equal(errors.length, 0, JSON.stringify(errors)); console.log(JSON.stringify({ departmentCreateAndManager: 'passed', memberEdit: 'passed', inviteCreateResendCancel: 'passed', separateBrowserAcceptance: 'passed', employeeReadOnly: 'passed', mobileOverflow: false, pageErrors: errors, network: 'intercepted; no email sent' }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1) });


