const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } }); await server.listen();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'owner@example.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
    const company = { id: '22222222-2222-4222-8222-222222222222', name: 'Record test company', team_mode: 'small', created_by: user.id, contact_email: user.email };
    let profile = { id: user.id, company_id: company.id, full_name: 'Record Owner', email: user.email, role: 'hr_admin', active: true, department_id: '33333333-3333-4333-8333-333333333333', role_start_date: '2026-10-01', role_description: 'Supplier reviews' };
    const other = { ...profile, id: '99999999-9999-4999-8999-999999999999', full_name: 'Department colleague' };
    const items = [], decisions = [], calls = [], suggestions = []; let note = null; let failRead = false, failSave = false, serial = 0;
    await page.route('https://*.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url()); let args = null; try { args = req.postDataJSON(); } catch {}
      calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: req.method(), args }); let body = {}, status = 200, total = null;
      if (url.pathname.endsWith('/token')) body = { access_token: 'record-token', refresh_token: 'record-refresh', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname.endsWith('/user')) body = user;
      else if (url.pathname.endsWith('/company_active_member_count')) body = 2;
      else if (url.pathname.endsWith('/work_notification_inbox')) body={unread:0,count:0,items:[]};
      else if (url.pathname.endsWith('/my_day_summary')) body = { pending_drafts: 0, completed_sections: [], forwarding_address: null };
      else if (url.pathname.includes('/storage/v1/object/sign/')) body = {signedURL: '/object/sign/role-documents/test.pdf?token=test-fixture'};
      else if (url.pathname.includes('/storage/v1/object/role-documents/')) body = {Key:'role-documents/test.pdf',Id:'test-file'};
      else if (url.pathname.endsWith('/responsibility_suggestions')) body = suggestions;
      else if (url.pathname.endsWith('/suggest_responsibility')) { suggestions.push({id:'suggestion-1',item_id:args.p_item,body:args.p_body,original_details:items.find(r=>r.id===args.p_item).details,status:'pending',item:{title:items.find(r=>r.id===args.p_item).title}});body='suggestion-1'; }
      else if (url.pathname.endsWith('/review_responsibility')) {const row=suggestions.find(r=>r.id===args.p_id);if(args.p_approve)items.find(r=>r.id===row.item_id).details=row.body;suggestions.splice(suggestions.indexOf(row),1);body=null;}
      else if (url.pathname.endsWith('/responsibility_notes')) {if(req.method()==='GET')body=note;else{note={...args};body={item_id:args.item_id||url.searchParams.get('item_id')?.slice(3)};}}
      else if (url.pathname.endsWith('/my_invitation')) body = [];
      else if (url.pathname.endsWith('/companies')) body = company;
      else if (url.pathname.endsWith('/profiles')) body = req.headers().accept?.includes('vnd.pgrst.object') ? profile : [profile, other];
      else if (url.pathname.endsWith('/role_items') || url.pathname.endsWith('/decisions')) {
        const rows = url.pathname.endsWith('/decisions') ? decisions : items;
        if (req.method() === 'POST' || req.method() === 'PATCH') {
          if (failSave) { status = 500; body = { message: 'Test save failure' }; }
          else {
            let row;
            if (req.method() === 'POST') { row = { id: `record-${++serial}`, ...args, created_at: new Date().toISOString(), deleted_at: null }; rows.unshift(row); }
            else { row = rows.find(row => `eq.${row.id}` === url.searchParams.get('id')); assert(row, 'update targets existing record'); Object.assign(row, args); }
            body = { id: row.id };
          }
        } else if (failRead) { status = 500; body = { message: 'Test read failure' }; }
        else {
          let filtered = rows.filter(row => `eq.${row.owner_id}` === url.searchParams.get('owner_id'));
          for (const field of ['kind', 'status']) if (url.searchParams.has(field)) filtered = filtered.filter(row => `eq.${row[field]}` === url.searchParams.get(field));
          if (url.searchParams.has('deleted_at')) filtered = filtered.filter(row => url.searchParams.get('deleted_at') === 'is.null' ? !row.deleted_at : Boolean(row.deleted_at));
          if (url.searchParams.has('title')) { const query = url.searchParams.get('title').replace('ilike.%', '').replace(/%$/, '').toLowerCase(); filtered = filtered.filter(row => row.title.toLowerCase().includes(query)); }
          total = filtered.length; const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 20);
          body = filtered.slice(offset, offset + limit).map(row => rows === decisions ? { ...row, workstream: items.find(item => item.id === row.workstream_id) ?? null } : row);
        }
      }
      // Match Supabase CORS: browsers need the count header explicitly exposed.
      const headers = total === null ? {} : { 'access-control-expose-headers': 'content-range', 'content-range': total ? `0-${Math.max(0, body.length - 1)}/${total}` : '*/0' };
      await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    });
    const source = await (await page.request.get('http://127.0.0.1:5173/')).text();
    assert(source.includes('class="boot-logo" src="/vimbre-lockup-compact-colour.svg"'));
    const favicon = await page.request.get('http://127.0.0.1:5173/favicon-192.png');
    assert.equal(favicon.status(), 200);
    const faviconBytes = await favicon.body(); assert.equal(faviconBytes.readUInt32BE(16), 192); assert.equal(faviconBytes.readUInt32BE(20), 192);
    await page.goto('http://127.0.0.1:5173/'); await page.getByRole('heading', { name: 'Someone leaving or away? The next person already knows where to start.' }).waitFor();
    await page.locator('.rs-brand .vimbre-logo-full').waitFor();
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/favicon-192.png');
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-site img.vimbre-logo')].every(img => img.complete && img.naturalWidth > 0));
    for (const width of [320, 390, 640, 768, 1440]) {
      await page.setViewportSize({width, height: 900});
      assert(await page.locator('.rs-brand .vimbre-logo-full').isVisible());
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `Brand header overflow at ${width}`);
    }
    await page.setViewportSize({width: 1280, height: 720});

    assert.equal(await page.locator('.rs-source').count(), 4); assert.equal(await page.locator('.rs-plan').count(), 4); assert.equal(await page.title(), 'Vimbre | Handover and Knowledge Retention for Teams'); await page.locator('#vimbre-boot').waitFor({ state: 'detached' });
    assert.equal(await page.getByText('Coming soon', { exact: true }).count(), 0);
    assert.equal(await page.locator('.rs-pricing').getByText('Coming soon', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('contentinfo').getByRole('link').count(), 5);
    assert.equal(await page.locator('.rs-site').getAttribute('data-theme'), 'light');
    assert.equal(await page.getByRole('button', { name: /Switch to .* theme/ }).count(), 0);
    for (const feature of ['Decision records', 'Tasks and dates', 'Role records', 'Team chat']) assert(await page.locator('.rs-pricing').getByText(feature, { exact: true }).first().isVisible());
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-plan')].every(el => el.classList.contains('rs-visible') && getComputedStyle(el).opacity === '1'));
    assert.equal(await page.locator('.rs-plan').last().evaluate(el => getComputedStyle(el).opacity), '1');
    for (const width of [360, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `landing overflow at ${width}`); }
    await page.setViewportSize({ width: 360, height: 800 }); await page.getByRole('button', { name: 'Open website menu', exact: true }).click(); await page.getByRole('navigation', { name: 'Public', exact: true }).getByRole('link', { name: 'How it works', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Open website menu', exact: true }).getAttribute('aria-expanded'), 'false'); await page.screenshot({ path: '/tmp/vimbre-public-mobile.png', fullPage: true, animations: 'disabled' }); await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('navigation', {name:'Public',exact:true}).getByRole('link',{name:'Contact',exact:true}).click();
    await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname, '/'); assert.equal(new URL(page.url()).hash,'#contact');
    assert.equal(await page.getByRole('link',{name:/support@vimbre.com/}).getAttribute('href'),'mailto:support@vimbre.com?subject=Vimbre%20support');
    assert.equal(await page.getByRole('link',{name:/hello@vimbre.com/}).getAttribute('href'),'mailto:hello@vimbre.com?subject=Vimbre%20enquiry');
    await page.waitForFunction(()=>{const top=document.querySelector('#contact').getBoundingClientRect().top;return top>=0&&top<innerHeight});
    assert(await page.locator('#contact').evaluate(el=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<innerHeight));
    for(const width of [320,390,640,768,1440]){await page.setViewportSize({width,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `Contact overflow at ${width}`);}
    assert.equal(await page.getByRole('contentinfo').getByRole('link').count(),5);
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open website menu',exact:true}).click();await page.getByRole('navigation',{name:'Public',exact:true}).getByRole('link',{name:'Contact',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Open website menu',exact:true}).getAttribute('aria-expanded'),'false');
    await page.goto('http://127.0.0.1:5173/contact');await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#contact');
    await page.waitForFunction(()=>{const top=document.querySelector('#contact').getBoundingClientRect().top;return top>=0&&top<innerHeight});
    await page.reload();await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#contact').getBoundingClientRect().top<innerHeight);
    await page.setViewportSize({width:1440,height:900});await page.locator('.rs-brand').click();await page.getByRole('heading',{name:'Someone leaving or away? The next person already knows where to start.'}).waitFor();
    await page.getByRole('link', { name: 'Get started', exact: true }).first().click(); await page.getByRole('heading', { name: 'Create your company' }).waitFor();
    await page.goto('http://127.0.0.1:5173/login'); assert(await page.locator('.v-auth-brand .vimbre-logo-full').isVisible()); await page.getByLabel('Work email').fill(user.email); await page.getByLabel('Password', { exact: true }).fill('test-record-password'); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert(await page.locator('.vw-brand-surface .vimbre-logo-full').isVisible()); assert.equal(await page.locator('.vw-brand-surface').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)'); await page.getByRole('button',{name:'Help',exact:true}).click();const help=page.getByRole('dialog',{name:'Contact support',exact:true});await help.waitFor();assert.equal(await help.getByRole('link',{name:'support@vimbre.com',exact:true}).getAttribute('href'),'mailto:support@vimbre.com?subject=Vimbre%20support');await help.getByRole('button',{name:'Close help',exact:true}).click(); await page.getByRole('link', { name: 'My role', exact: true }).click(); await page.getByRole('heading', { name: 'Role record', exact: true }).waitFor();
    // Sidebar collapse is persistent, hides its links from focus, and expands content.
    assert(await page.locator('.vw-account').getByText('Super admin',{exact:true}).isVisible());
    assert(await page.locator('.vw-brand .vimbre-logo-full').evaluate(el=>el.getBoundingClientRect().width<=100));
    const before=await page.locator('.vw-content').evaluate(el=>el.getBoundingClientRect().width);
    await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
    assert(!await page.locator('.vw-sidebar').isVisible());
    assert((await page.locator('.vw-content').evaluate(el=>el.getBoundingClientRect().width))>before);
    await page.reload();await page.getByRole('heading',{name:'Role record',exact:true}).waitFor();
    assert(!await page.locator('.vw-sidebar').isVisible());
    await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
    await page.getByText('In this role since',{exact:false}).waitFor();
    assert(await page.getByText('1 Oct 2026',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Add responsibility',exact:true}).click();
    const panel=page.getByRole('dialog',{name:'Add responsibility',exact:true});await panel.waitFor();
    assert.equal(await panel.getByRole('heading').evaluate(el=>getComputedStyle(el).fontSize),'24px');
    assert.equal(await panel.getByLabel('Title',{exact:true}).inputValue(),'');
    assert((await panel.getByLabel('Title',{exact:true}).getAttribute('placeholder')).includes('weekly operations report'));
    assert.equal(await panel.getByLabel('Deadline (optional)',{exact:true}).count(),0);
    await panel.getByLabel('Title',{exact:true}).fill('Weekly review');await panel.getByLabel('What it involves',{exact:true}).fill('Prepare notes and keep the reasons.');await panel.getByLabel('How often',{exact:true}).selectOption('Weekly');
    failSave=true;await panel.getByRole('button',{name:'Save',exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal(await panel.getByLabel('Title',{exact:true}).inputValue(),'Weekly review');
    failSave=false;await panel.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('heading',{name:'Weekly review',exact:true}).waitFor();assert.equal(items[0].recurrence,'Weekly');
    assert.equal(items[0].due_date,undefined);
    // Escape closes the panel and returns keyboard focus to its trigger.
    await page.getByRole('button',{name:'Add responsibility',exact:true}).click();await panel.waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert(!await panel.isVisible());
    assert(await page.getByRole('button',{name:'Add responsibility',exact:true}).evaluate(el=>el===document.activeElement));
    for(const [tab,button,label,name] of [['Open work','Add open work','Name','Service reviews'],['External contacts','Add external contact','Name','Ada Okafor'],['Documents','Add document','Title','Review guide'],['Recurring deadlines','Add deadline','What is due','Friday review']]){
      await page.getByRole('button',{name:tab,exact:true}).click();await page.getByRole('button',{name:button,exact:true}).click();const drawer=page.getByRole('dialog',{name:button,exact:true});await drawer.getByLabel(label,{exact:true}).fill(name);
      if(tab==='Open work'){await drawer.getByLabel('What is happening',{exact:true}).fill('Checking supplier notes');await drawer.getByLabel('Status',{exact:true}).selectOption('waiting');await drawer.getByLabel('Next step',{exact:true}).fill('Share notes');}
      if(tab==='External contacts'){await drawer.getByLabel('Organisation',{exact:true}).fill('Acme Supplies');await drawer.getByLabel('Email or phone',{exact:true}).fill('ada@example.invalid');await drawer.getByLabel('What to know before contacting them',{exact:true}).fill('Include the order reference');}
      if(tab==='Documents'){await drawer.getByLabel('Link (optional)',{exact:true}).fill('https://example.invalid/guide');await drawer.getByLabel('Or upload a file',{exact:true}).setInputFiles({name:'guide.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test fixture')});}
      if(tab==='Recurring deadlines'){await drawer.getByLabel('Next due date',{exact:true}).fill('2026-10-23');await drawer.getByLabel('How often',{exact:true}).fill('Every Friday');}
      await drawer.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('heading',{name,exact:true}).waitFor();
    }
    await page.getByRole('button',{name:'Documents',exact:true}).click();await page.getByRole('button',{name:'View uploaded document',exact:true}).click();const fileLink=page.getByRole('link',{name:'Open uploaded document',exact:true});await fileLink.waitFor();assert((await fileLink.getAttribute('href')).includes('/storage/v1/object/sign/'));assert(!calls.some(row=>row.path.includes('/storage/v1/object/public/')));
    await page.getByRole('button',{name:'Decision log',exact:true}).click();await page.getByRole('button',{name:'Log a decision',exact:true}).click();const decisionPanel=page.getByRole('dialog',{name:'Log a decision',exact:true});
    assert.equal(await decisionPanel.getByLabel('Owner',{exact:true}).inputValue(),profile.full_name);assert.match(await decisionPanel.getByLabel('Date',{exact:true}).inputValue(),/^\d{4}-\d{2}-\d{2}$/);
    await decisionPanel.getByLabel('Decision',{exact:true}).fill('Keep weekly reviews');await decisionPanel.getByLabel('Why',{exact:true}).fill('Give the next person the context.');await decisionPanel.getByLabel('Next step',{exact:true}).fill('Share the review notes');await decisionPanel.getByLabel('Link to email or notes (optional)',{exact:true}).fill('https://example.invalid/source');await decisionPanel.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('heading',{name:'Keep weekly reviews',exact:true}).waitFor();assert.equal(decisions[0].next_step,'Share the review notes');
    // Editing preserves existing status and linked work instead of silently clearing them.
    decisions[0].status='replaced';decisions[0].workstream_id=items.find(r=>r.kind==='workstream').id;decisions[0].related_task_url='https://example.invalid/task';
    await page.getByRole('button',{name:'Edit Keep weekly reviews',exact:true}).click();await page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Edit decision',exact:true})}).getByRole('button',{name:'Save',exact:true}).click();assert.equal(decisions[0].status,'replaced');assert.equal(decisions[0].related_task_url,'https://example.invalid/task');
    await page.getByLabel('Filter decision status').selectOption('live');await page.getByText('No records match these filters.',{exact:true}).waitFor();await page.getByLabel('Filter decision status').selectOption('all');
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Archive Keep weekly reviews',exact:true}).click();await page.getByText('No decision log yet.',{exact:false}).waitFor();await page.getByLabel('Show archived records').check();await page.getByRole('button',{name:'Restore Keep weekly reviews',exact:true}).click();await page.getByText('No archived records here.',{exact:true}).waitFor();await page.getByLabel('Show archived records').uncheck();await page.getByRole('heading',{name:'Keep weekly reviews',exact:true}).waitFor();
    await page.reload();await page.getByRole('button',{name:'Decision log',exact:true}).click();await page.getByRole('heading',{name:'Keep weekly reviews',exact:true}).waitFor();assert(calls.some(row=>row.path.endsWith('/log_role_view')));
    failRead=true;await page.getByRole('button',{name:'Documents',exact:true}).click();await page.getByRole('alert').filter({hasText:'Records could not be loaded'}).waitFor();failRead=false;await page.getByRole('button',{name:'Retry records'}).click();await page.getByRole('heading',{name:'Review guide',exact:true}).waitFor();
    for(let index=0;index<22;index++)items.push({id:`extra-${index}`,kind:'responsibility',title:`Responsibility ${index}`,owner_id:user.id,company_id:company.id,details:'',deleted_at:null});
    await page.getByRole('button',{name:'Responsibilities',exact:true}).click();await page.getByRole('button',{name:'Next records',exact:true}).click();await page.getByText('Page 2',{exact:true}).waitFor();
    // Employee responsibilities are read only, with private notes and approval requests.
    profile={...profile,role:'employee'};await page.reload();await page.getByRole('button',{name:'Responsibilities',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Add responsibility',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Edit Weekly review',exact:true}).count(),0);
    await page.getByRole('button',{name:'My notes',exact:true}).first().click();const notes=page.getByRole('dialog',{name:'My notes',exact:true});await notes.getByLabel('Your notes',{exact:true}).fill('Private reminder');await notes.getByRole('button',{name:'Save notes',exact:true}).click();await page.getByRole('status').filter({hasText:'Notes saved.'}).waitFor();assert.equal(note.body,'Private reminder');
    await page.getByRole('button',{name:'Suggest a change',exact:true}).first().click();const suggestion=page.getByRole('dialog',{name:'Suggest a change',exact:true});await suggestion.getByLabel('Suggested description',{exact:true}).fill('Updated review description');await suggestion.getByRole('button',{name:'Send suggestion',exact:true}).click();await page.getByRole('heading',{name:'Your pending suggestions',exact:true}).waitFor();assert.equal(suggestions[0].body,'Updated review description');
    for(const width of [360,768,1024,1440]){await page.setViewportSize({width,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`Workspace overflow at ${width}`);}
    await page.setViewportSize({width:360,height:800});await page.getByRole('button',{name:'My notes',exact:true}).first().click();await page.getByRole('dialog',{name:'My notes',exact:true}).waitFor();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:'/tmp/vimbre-landing-role-mobile.png',fullPage:true});await page.keyboard.press('Escape');
    // Collapsing on desktop does not hide the mobile menu.
    await page.setViewportSize({width:1440,height:900});profile={...profile,role:'manager'};await page.reload();await page.getByRole('heading',{name:'Suggestions to review',exact:true}).waitFor();await page.getByRole('button',{name:'Approve',exact:true}).click();await page.getByRole('status').filter({hasText:'Suggestion approved.'}).waitFor();
    await page.getByLabel('Role record owner').selectOption(other.id);await page.getByRole('heading',{name:other.full_name,exact:true}).first().waitFor();assert(await page.getByRole('button',{name:'Add responsibility',exact:true}).isVisible());
    await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.setViewportSize({width:360,height:800});assert(await page.getByRole('button',{name:'Menu',exact:true}).isVisible());await page.getByRole('button',{name:'Menu',exact:true}).click();assert(await page.getByRole('link',{name:'My day',exact:true}).isVisible());await page.getByRole('button',{name:'Close menu',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Expand sidebar',exact:true}).click();
    await page.screenshot({path:'/tmp/vimbre-landing-dashboard-desktop.png',fullPage:true});
    await page.getByRole('link', { name: 'Back to website', exact: true }).click(); await page.getByRole('heading', { name: 'Someone leaving or away? The next person already knows where to start.', exact: true }).waitFor(); await page.setViewportSize({ width: 360, height: 800 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'signed-in public header overflow'); await page.setViewportSize({ width: 1440, height: 900 }); assert.equal(await page.getByRole('link', { name: 'Log in', exact: true }).count(), 0); await page.reload(); await page.getByRole('link', { name: 'Open workspace', exact: true }).first().click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert.equal(new URL(page.url()).pathname, '/app'); await page.goto('http://127.0.0.1:5173/signup'); await page.getByRole('heading', { name: 'Create your company', exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5173/'); await page.emulateMedia({ reducedMotion: 'reduce' }); assert.equal(await page.locator('.rs-hero').evaluate(el => getComputedStyle(el).animationName), 'none'); await page.screenshot({ path: '/tmp/vimbre-landing-desktop.png', fullPage: true });
    assert.equal(errors.length, 0, JSON.stringify(errors)); console.log(JSON.stringify({ publicEntryAndWorkspace: 'passed', fiveRecordCategories: 'passed', decisionWorkstreamStatusLinks: 'passed', archiveRestoreReload: 'passed', failedSaveRetainsDraft: 'passed', readRetry: 'passed', pagination: 'passed', employeeResponsibilitiesReadOnly: 'passed', managerEdits: 'passed', notesAndApprovals: 'passed', sidebarCollapse: 'passed', mobileOverflow: false, pageErrors: errors, network: 'intercepted; no real user data created' }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });


