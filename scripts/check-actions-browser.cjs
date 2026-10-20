const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } }); await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ timezoneId: 'Africa/Lagos' }); const page = await context.newPage(); page.setDefaultTimeout(10000);
    await page.clock.setFixedTime(new Date('2026-10-16T10:00:00Z'));
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'owner@example.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
    const company = { id: '22222222-2222-4222-8222-222222222222', name: 'Action test company', team_mode: 'small' };
    let profile = { id: user.id, company_id: company.id, full_name: 'Action Owner', email: user.email, role: 'employee', active: true, department_id: '44444444-4444-4444-8444-444444444444' };
    const colleague = { ...profile, id: '99999999-9999-4999-8999-999999999999', full_name: 'Department colleague' };
    const decision = { id: '33333333-3333-4333-8333-333333333333', owner_id: user.id, title: 'Weekly reporting', deleted_at: null };
    const actions = [], calls = []; let failSave = false, failRead = false, failTeam = false; let summary = { pending_drafts: 2, completed_sections: ['responsibility'], forwarding_address: null }; let teamMembers = [colleague];
    await page.route('https://*.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url()); let args = null; try { args = req.postDataJSON(); } catch {}
      calls.push({ path: url.pathname, method: req.method(), params: Object.fromEntries(url.searchParams), args }); let body = {}, status = 200, total = null;
      if (url.pathname.endsWith('/token')) body = { access_token: 'actions-token', refresh_token: 'actions-refresh', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname.endsWith('/user')) body = user;
      else if (url.pathname.endsWith('/company_active_member_count')) body = 1 + teamMembers.length;
      else if (url.pathname.endsWith('/team_activity_overview')) {
        if (failTeam) { status=500; body={message:'Test overview failure'}; }
        else {
          let rows=[profile,...teamMembers].map(person=>({id:person.id,full_name:person.full_name,tasks_done:actions.filter(a=>a.owner_id===person.id&&a.status==='done'&&!a.deleted_at).length,tasks_overdue:actions.filter(a=>a.owner_id===person.id&&a.status!=='done'&&!a.deleted_at&&a.due_date<'2026-10-16').length,drafts_waiting:person.id===colleague.id?4:0,handover_status:null,no_role_record:person.id===colleague.id}));
          const flags={overdue_tasks:rows.reduce((n,r)=>n+r.tasks_overdue,0),handovers_not_started:null,people_without_role_record:rows.filter(r=>r.no_role_record).length};
          if(args.p_member)rows=rows.filter(r=>r.id===args.p_member);
          if(args.p_search)rows=rows.filter(r=>r.full_name.toLowerCase().includes(args.p_search.toLowerCase()));
          body={rows:rows.slice(args.p_page*20,args.p_page*20+20),count:rows.length,total_active_count:1+teamMembers.length,scope:profile.role==='hr_admin'?'company':'department',today:'2026-10-16',week_start:'2026-10-12',flags,handovers_available:false};
        }
      }
      else if (url.pathname.endsWith('/work_notification_inbox')) body={unread:0,count:0,items:[]};
      else if (url.pathname.endsWith('/my_day_summary')) body = summary;
      else if (url.pathname.endsWith('/my_invitation')) body = [];
      else if (url.pathname.endsWith('/companies')) body = company;
      else if (url.pathname.endsWith('/profiles')) {
        if (req.headers().accept?.includes('vnd.pgrst.object')) body = profile;
        else if (failTeam) { status = 500; body = { message: 'Test roster failure' }; }
        else {
          let rows = [profile, ...teamMembers];
          if (url.searchParams.has('id')) rows = rows.filter(row => `neq.${row.id}` !== url.searchParams.get('id'));
          const query = (url.searchParams.get('full_name') || '').replace(/^ilike\.%/, '').replace(/%$/, '').toLowerCase(); rows = rows.filter(row => row.full_name.toLowerCase().includes(query));
          total = rows.length; const offset = Number(url.searchParams.get('offset') || 0); body = rows.slice(offset, offset + Number(url.searchParams.get('limit') || 20));
        }
      }
      else if (url.pathname.endsWith('/decisions')) body = url.searchParams.get('owner_id')===`eq.${colleague.id}` ? [{...decision,id:randomUUID(),owner_id:colleague.id,title:'Confirmed team decision',reason:'Approved by Finance.',decided_by:'Finance',decided_on:'2026-10-16',status:'live',source_url:null}] : [decision];
      else if (url.pathname.endsWith('/actions')) {
        if (['POST', 'PATCH'].includes(req.method())) {
          if (failSave) { status = 500; body = { message: 'Test save failure' }; }
          else {
            let row;
            if (req.method() === 'POST') { row = { id: randomUUID(), ...args, deleted_at: null, completed_at: args.status === 'done' ? new Date().toISOString() : null }; actions.push(row); }
            else { row = actions.find(row => `eq.${row.id}` === url.searchParams.get('id')); assert(row); Object.assign(row, args); row.completed_at = row.status === 'done' ? new Date().toISOString() : null; }
            body = { id: row.id };
          }
        } else if (failRead) { status = 500; body = { message: 'Test read failure' }; }
        else {
          let rows = actions.filter(row => `eq.${row.owner_id}` === url.searchParams.get('owner_id'));
          for (const field of ['status', 'decision_id', 'due_date']) if (url.searchParams.has(field)) { const filter = url.searchParams.get(field), [op, ...tail] = filter.split('.'), value = tail.join('.'); rows = rows.filter(row => op === 'eq' ? row[field] === value : op === 'neq' ? row[field] !== value : row[field] < value); }
          if (url.searchParams.has('deleted_at')) rows = rows.filter(row => url.searchParams.get('deleted_at') === 'is.null' ? !row.deleted_at : Boolean(row.deleted_at));
          const query = (url.searchParams.get('title') || '').replace(/^ilike\.%/, '').replace(/%$/, '').toLowerCase(); rows = rows.filter(row => row.title.toLowerCase().includes(query));
          rows.sort((a, b) => a.due_date.localeCompare(b.due_date)); total = rows.length;
          body = rows.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(url.searchParams.get('limit') || 20)).map(row => ({ ...row, decision: row.decision_id === decision.id ? decision : null }));
        }
      }
      const headers = total === null ? {} : { 'access-control-expose-headers': 'content-range', 'content-range': total ? `0-${Math.max(0, body.length - 1)}/${total}` : '*/0' };
      await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:5173/login'); assert.equal(await page.getByLabel('Work email').inputValue(), ''); assert.equal(await page.getByLabel('Work email').getAttribute('placeholder'), 'you@company.com'); await page.getByLabel('Work email').fill(user.email); await page.getByLabel('Password', { exact: true }).fill('actions-test-password'); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor();
    await page.getByRole('heading', {name:'Good morning, Action',exact:true}).waitFor();
    await page.clock.setFixedTime(new Date('2026-10-16T15:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', {name:'Good evening, Action',exact:true}).waitFor();
    await page.clock.setFixedTime(new Date('2026-10-16T11:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', {name:'Good afternoon, Action',exact:true}).waitFor();
    await page.clock.setFixedTime(new Date('2026-10-16T10:00:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', {name:'Good morning, Action',exact:true}).waitFor();
    await page.getByRole('link', { name: 'Capture an email or notes', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Today', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByText('Nothing due today. Forward an email or add a task.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add task', exact: true }).count(), 1);
    await page.getByRole('link', { name: '2 drafts to review', exact: true }).waitFor();
    await page.getByText('1 of 5 done', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'What my manager can see', exact: true }).count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Open role record', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Projects you handle, not done', exact: true }).getAttribute('href'), '/app/role-record?section=workstream');
    assert.equal(await page.getByRole('heading', { name: 'Forward emails to your Vimbre address', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('View actions for').count(), 0);
    await page.getByRole('button', { name: 'Add task', exact: true }).click(); assert.equal(await page.getByLabel('What needs to be done?').inputValue(), ''); assert((await page.getByLabel('What needs to be done?').getAttribute('placeholder')).includes('weekly operations report')); assert.equal(await page.getByLabel('Due date').getAttribute('type'), 'date'); assert.equal(await page.getByLabel('Due date').getAttribute('required'), ''); assert.equal(await page.getByText('A task is one piece of work you need to finish. Give it a clear outcome and a due date.', { exact: true }).count(), 0);
    await page.setViewportSize({ width: 360, height: 800 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await page.screenshot({ path: '/tmp/vimbre-action-example-form.png', fullPage: true, animations: 'disabled' }); await page.setViewportSize({ width: 1440, height: 900 });
    // Required placeholders cannot become saved facts.
    await page.getByRole('button', { name: 'Save task', exact: true }).click(); assert.equal(actions.length, 0);
    await page.getByLabel('What needs to be done?').fill('Send the report'); await page.getByLabel('Due date').fill('2026-10-16'); await page.getByLabel('Task status').selectOption('in_progress'); await page.getByLabel('Related decision (optional)').selectOption(decision.id);
    failSave = true; await page.getByRole('button', { name: 'Save task', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'draft is still here' }).waitFor(); assert.equal(await page.getByLabel('What needs to be done?').inputValue(), 'Send the report'); failSave = false;
    await page.getByRole('button', { name: 'Save task', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor(); assert.equal(actions[0].decision_id, decision.id); assert(!Object.hasOwn(calls.find(row => row.path.endsWith('/actions') && row.method === 'POST').args, 'completed_at'));
    await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Overdue', exact: true }).click(); await page.getByText('No overdue tasks.', { exact: true }).waitFor();
    actions.push({ ...actions[0], id: randomUUID(), title: 'Check older figures', due_date: '2026-10-15', decision_id: null });
    await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByRole('heading', { name: 'Check older figures', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Overdue', exact: true }).click(); await page.getByRole('heading', { name: 'Check older figures', exact: true }).waitFor(); assert.equal(await page.getByRole('heading', { name: 'Send the report', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByRole('button', { name: 'Complete Send the report', exact: true }).click(); await page.getByLabel('Anything the next person should know?').fill('Sent to Finance. They will reply on Monday.'); await page.getByRole('button', { name: 'Mark done', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Task completed' }).waitFor();
    await page.getByRole('button', { name: 'Recently done', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor(); await page.getByText('Sent to Finance. They will reply on Monday.', { exact: false }).waitFor();
    await page.reload(); await page.getByRole('button', { name: 'Recently done', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reopen Send the report', exact: true }).click(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit Send the report', exact: true }).click(); await page.getByLabel('Details', { exact: true }).fill('Check with Finance before sending.'); await page.getByRole('button', { name: 'Save task', exact: true }).click(); await page.getByText('Check with Finance before sending.', { exact: true }).waitFor();
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Archive Send the report', exact: true }).click(); await page.getByRole('button', { name: 'Archived', exact: true }).click(); await page.getByRole('button', { name: 'Restore Send the report', exact: true }).click(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    await page.goto(`http://127.0.0.1:5173/app?decision=${decision.id}`); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor(); assert.equal(await page.getByRole('heading', { name: 'Check older figures', exact: true }).count(), 0); await page.getByRole('button', { name: 'Show all decisions', exact: true }).click(); await page.getByRole('heading', { name: 'Check older figures', exact: true }).waitFor();
    failRead = true; await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Tasks could not be loaded' }).waitFor(); failRead = false; await page.getByRole('button', { name: 'Retry tasks' }).click(); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByLabel('Search tasks').fill('no match'); await page.getByText('No tasks match these filters.', { exact: true }).waitFor(); await page.getByLabel('Search tasks').fill(''); await page.getByRole('heading', { name: 'Send the report', exact: true }).waitFor();
    for (let index = 0; index < 22; index++) actions.push({ ...actions[0], id: randomUUID(), title: `Extra action ${index}` });
    await page.reload(); await page.getByRole('button', { name: 'Open', exact: true }).click(); await page.getByRole('button', { name: 'Next tasks', exact: true }).click(); await page.getByText('Page 2', { exact: true }).waitFor();
    await page.setViewportSize({ width: 360, height: 800 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await page.screenshot({ path: '/tmp/vimbre-actions-mobile.png', fullPage: true, animations: 'disabled' });
    summary = { pending_drafts: 0, completed_sections: ['responsibility', 'document'], forwarding_address: 'fixture-inbound@example.invalid' };
    await page.reload();
    await page.getByRole('heading', { name: 'Forward emails to your Vimbre address', exact: true }).waitFor();
    await page.getByText('fixture-inbound@example.invalid', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Copy address', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /drafts? to review/ }).count(), 0);
    await page.getByText('2 of 5 done', { exact: true }).waitFor();
    profile = { ...profile, role: 'manager' }; await page.reload();
    await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert.equal(await page.getByLabel('View actions for').count(), 0); assert.equal(await page.getByLabel('Find a team member').count(), 0); await page.getByRole('button', { name: 'Add task', exact: true }).waitFor();
    actions.push({ ...actions[0], id: randomUUID(), owner_id: colleague.id, title: 'Colleague completed report', status: 'done', completed_at: new Date().toISOString(), completion_note: 'Figures checked and report sent.' });
    await page.getByRole('button', { name: 'Menu', exact: true }).click(); await page.getByRole('link', { name: 'Team activity', exact: true }).click(); await page.getByRole('heading', { name: 'Team activity', exact: true }).waitFor();
    await page.getByText('See what your team has captured, finished and left open.',{exact:true}).waitFor();
    await page.getByRole('link', { name: colleague.full_name, exact: true }).waitFor();
    for (const width of [320,360,390,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`team overview overflow at ${width}`);
      const geometry=await page.locator('.vt-members').evaluate(table=>{
        const row=table.querySelector('tbody tr'),cells=[...row.querySelectorAll('td')];
        return {tableWidth:table.getBoundingClientRect().width,parentWidth:table.parentElement.clientWidth,rowDisplay:getComputedStyle(row).display,labels:cells.slice(1).map(cell=>({label:cell.dataset.label,visible:getComputedStyle(cell,'::before').content})),headerDisplay:getComputedStyle(table.querySelector('thead')).display};
      });
      assert(geometry.tableWidth<=geometry.parentWidth+1,`team table wider than container at ${width}`);
      if(width<=760){
        assert.equal(geometry.rowDisplay,'grid');
        for(const cell of geometry.labels)assert.equal(cell.visible,JSON.stringify(cell.label),`missing metric label at ${width}`);
      } else {assert.equal(geometry.rowDisplay,'table-row');assert.notEqual(geometry.headerDisplay,'none');}
    }
    await page.setViewportSize({width:360,height:800});

    await page.getByRole('link',{name:'Back to My day',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Search team members').count(),0);
    for(const width of [360,1440]) {
      await page.setViewportSize({width,height:900});
      const before=page.url();
      const trigger=page.getByRole('button',{name:'You can see confirmed tasks and decisions. You cannot see private drafts or the original emails.',exact:true});
      await trigger.click();
      const dialog=page.getByRole('dialog',{name:'Team visibility',exact:true});await dialog.waitFor();
      assert.equal(page.url(),before,'visibility must keep the current page');
      await dialog.getByText('Managers can read responsibilities, workstreams, external contacts, document links, recurring deadlines, decisions, tasks, completion notes and archived records within their department. HR Admins can read these across the company.',{exact:true}).waitFor();
      await dialog.getByRole('button',{name:'Close access details',exact:true}).click();
      assert.equal(await dialog.isVisible(),false);assert(await trigger.evaluate(el=>document.activeElement===el));
      await trigger.click();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
      assert.equal(page.url(),before);
    }
    await page.setViewportSize({width:360,height:800});
    await page.getByRole('link', { name: colleague.full_name, exact: true }).click(); await page.getByRole('heading', { name: `${colleague.full_name}’s tasks`, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add task', exact: true }).count(), 0); assert.equal(await page.getByRole('button', { name: /^Complete / }).count(), 0);
    await page.getByRole('button', { name: 'Recently done', exact: true }).click(); await page.getByRole('heading', { name: 'Colleague completed report', exact: true }).waitFor(); await page.getByText('Figures checked and report sent.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Edit / }).count(), 0); await page.screenshot({ path: '/tmp/vimbre-team-activity-mobile.png', fullPage: true, animations: 'disabled' }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await page.getByRole('heading', { name: 'Confirmed team decision', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to team overview', exact: true }).click();
    assert.equal(await page.getByLabel('Search team members').count(),0);
    for(let i=0;i<2;i++)teamMembers.push({...colleague,id:randomUUID(),full_name:`Small team ${i}`});
    await page.reload();assert.equal(await page.getByLabel('Search team members').count(),0);
    teamMembers.push({...colleague,id:randomUUID(),full_name:'Fifth member'});await page.reload();
     await page.getByLabel('Search team members').fill('nobody'); await page.getByRole('heading', { name: 'No names match your search', exact: true }).waitFor(); await page.getByLabel('Search team members').fill(''); await page.getByRole('link', { name: colleague.full_name, exact: true }).waitFor();
    for (let index = 0; index < 22; index++) teamMembers.push({ ...colleague, id: randomUUID(), full_name: `Teammate ${index}` });
    await page.reload(); await page.getByRole('button', { name: 'Next people', exact: true }).click(); await page.getByText('Page 2', { exact: true }).waitFor();
    teamMembers = []; await page.reload(); await page.getByText('It’s just you so far. Invite a teammate to see their work here.',{exact:true}).waitFor(); assert.equal(await page.getByRole('navigation',{name:'Workspace'}).getByRole('link',{name:'Team activity',exact:true}).count(),0);
    profile = { ...profile, department_id: null }; await page.reload(); await page.getByRole('heading', { name: 'Your department is not set up yet', exact: true }).waitFor(); assert.equal(await page.getByLabel('Search team members').count(), 0);
    profile = { ...profile, role: 'hr_admin' }; await page.reload(); await page.getByRole('link', { name: 'Invite a teammate', exact: true }).waitFor();
    failTeam = true; await page.reload(); await page.getByRole('alert').filter({ hasText: 'Your team could not be loaded' }).waitFor(); failTeam = false; teamMembers = [colleague]; await page.getByRole('button', { name: 'Retry team activity', exact: true }).click(); await page.getByRole('link', { name: colleague.full_name, exact: true }).waitFor();
    profile = { ...profile, role: 'employee' }; const rosterCalls = calls.filter(row => row.path.endsWith('/profiles') && row.params.select === 'id,full_name').length;
    await page.reload(); await page.getByText('This page is for Managers and HR Admins.', { exact: false }).waitFor(); assert.equal(await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Team activity', exact: true }).count(), 0); assert.equal(calls.filter(row => row.path.endsWith('/profiles') && row.params.select === 'id,full_name').length, rosterCalls);
    await page.getByRole('link', { name: 'Open My day', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor();

    assert.equal(errors.length, 0, JSON.stringify(errors)); console.log(JSON.stringify({ examplesAndRequiredFields: 'passed', actionCreateEdit: 'passed', failedSaveDraft: 'passed', localDateDueViews: 'passed', completionNoteReloadReopen: 'passed', archiveRestore: 'passed', decisionLinksSearchPagination: 'passed', readRetry: 'passed', managerReadOnly: 'passed', personalMyDay: 'passed', teamActivityAndOutcomes: 'passed', teamEmptySearchPaginationRetry: 'passed', noDepartmentGuidance: 'passed', employeeTeamPageGuard: 'passed', mobileOverflow: false, pageErrors: errors, network: 'intercepted; no real records created' }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });

