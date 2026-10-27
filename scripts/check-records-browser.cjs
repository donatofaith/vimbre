const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true } }); await server.listen();
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}) });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'owner@example.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
    const company = { id: '22222222-2222-4222-8222-222222222222', name: 'Record test company', team_mode: 'small', created_by: user.id, contact_email: user.email };
    let profile = { id: user.id, company_id: company.id, full_name: 'Record Owner', email: user.email, role: 'hr_admin', active: true, department_id: '33333333-3333-4333-8333-333333333333', role_start_date: '2026-10-01', role_description: 'Supplier reviews' };
    const other = { ...profile, id: '99999999-9999-4999-8999-999999999999', full_name: 'Department colleague' };
    const items = [], decisions = [], calls = [], suggestions = []; let note = null; let failRead = false, failSave = false, serial = 0;
 const roleFixture=require('./role-workspace-fixture.cjs')(user);
    await page.route('https://*.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url()); let args = null; try { args = req.postDataJSON(); } catch {}
      calls.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: req.method(), args }); let body = {}, status = 200, total = null;
      if(url.pathname.endsWith('/role_workspace')){try{body=roleFixture.handle(args)}catch(e){status=500;body={message:e.message}}}
      else if (url.pathname.endsWith('/token')) body = { access_token: 'record-token', refresh_token: 'record-refresh', expires_in: 3600, token_type: 'bearer', user };
      else if (url.pathname.endsWith('/user')) body = user;
      else if (url.pathname.endsWith('/company_active_member_count')) body = 2;
      else if (url.pathname.endsWith('/work_notification_inbox')) body={unread:0,count:0,items:[]};
      else if(url.pathname.endsWith('/myday_alerts'))body=[];
      else if(url.pathname.endsWith('/myday_preferences'))body={timezone:'Europe/London',reminder_time:'09:00',email_enabled:true,email_delivery_ready:false};
      else if(url.pathname.endsWith('/myday_notes'))body={rows:[],count:0};
      else if(url.pathname.endsWith('/myday_tasks'))body={rows:[],count:0,today:'2026-10-22',timezone:'Europe/London',counts:{todo:0,progress:0,overdue:0},has_work:false,context_waiting:[]};
      else if(url.pathname.endsWith('/myday_valid_recurrence'))body=true;
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
          for (const field of ['kind', 'status']) if (url.searchParams.has(field)) {const filter=url.searchParams.get(field);filtered=filtered.filter(row=>filter.startsWith('in.(')?filter.slice(4,-1).split(',').includes(row[field]):`eq.${row[field]}`===filter);}
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
    await page.goto('http://127.0.0.1:5173/'); await page.getByRole('heading', { name: 'The missing layer behind your work.' }).waitFor();
    await page.locator('.rs-brand .vimbre-logo-full').waitFor();
    assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), '/favicon-192.png');
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-site img.vimbre-logo')].every(img => img.complete && img.naturalWidth > 0));
    for (const width of [320,360,390,430,640,768,820,834,1024,1180,1280,1366,1440,1920]) {
      await page.setViewportSize({width, height: 900});
      assert(await page.locator('.rs-brand .vimbre-logo-full').isVisible());
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `Brand header overflow at ${width}`);
    }
    await page.setViewportSize({width: 1280, height: 720});

    assert.equal(await page.locator('.rs-source').count(), 4); assert.equal(await page.locator('.rs-plan').count(), 4); assert.equal(await page.title(), 'Vimbre | Work Intelligence and Handover Context'); await page.locator('#vimbre-boot').waitFor({ state: 'detached' });
    assert.equal(await page.getByText('Coming soon', { exact: true }).count(), 0);
    assert.equal(await page.locator('.rs-pricing').getByText('Coming soon', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('contentinfo').getByRole('link').count(), 8); assert.equal(await page.getByRole('contentinfo').getByRole('link',{name:'Terms',exact:true}).getAttribute('href'),'/terms');
    assert.equal(await page.locator('.rs-site').getAttribute('data-theme'), 'light');
    assert.equal(await page.getByRole('button', { name: /Switch to .* theme/ }).count(), 0);
    for (const feature of ['Decision records', 'Tasks and dates', 'Role records', 'Team chat']) assert(await page.locator('.rs-pricing').getByText(feature, { exact: true }).first().isVisible());
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.rs-plan')].every(el => el.classList.contains('rs-visible') && getComputedStyle(el).opacity === '1'));
    assert.equal(await page.locator('.rs-plan').last().evaluate(el => getComputedStyle(el).opacity), '1');
    for (const width of [360, 1440]) { await page.setViewportSize({ width, height: 900 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `landing overflow at ${width}`); }
    await page.setViewportSize({ width: 360, height: 800 }); await page.getByRole('button', { name: 'Open website menu', exact: true }).click(); await page.getByRole('navigation', { name: 'Public', exact: true }).getByRole('link', { name: 'How it works', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Open website menu', exact: true }).getAttribute('aria-expanded'), 'false'); await page.screenshot({ path: '/tmp/vimbre-public-mobile.png', fullPage: true, animations: 'disabled' }); await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('navigation', {name:'Footer',exact:true}).getByRole('link',{name:'Contact',exact:true}).click();
    await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname, '/'); assert.equal(new URL(page.url()).hash,'#contact');
    assert.equal(await page.getByRole('link',{name:/support@vimbre.com/}).getAttribute('href'),'mailto:support@vimbre.com?subject=Vimbre%20support');
    assert.equal(await page.getByRole('link',{name:/hello@vimbre.com/}).getAttribute('href'),'mailto:hello@vimbre.com?subject=Vimbre%20enquiry');
    await page.waitForFunction(()=>{const top=document.querySelector('#contact').getBoundingClientRect().top;return top>=0&&top<innerHeight});
    assert(await page.locator('#contact').evaluate(el=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<innerHeight));
    for(const width of [320,360,390,430,640,768,820,834,1024,1180,1280,1366,1440,1920]){await page.setViewportSize({width,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth), `Contact overflow at ${width}`);}
    assert.equal(await page.getByRole('contentinfo').getByRole('link').count(),7);
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open website menu',exact:true}).click();await page.getByRole('navigation',{name:'Public',exact:true}).getByRole('link',{name:'FAQ',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Open website menu',exact:true}).getAttribute('aria-expanded'),'false');
    await page.goto('http://127.0.0.1:5173/contact');await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#contact');
    await page.waitForFunction(()=>{const top=document.querySelector('#contact').getBoundingClientRect().top;return top>=0&&top<innerHeight});
    await page.reload();await page.getByRole('heading',{name:'How can we help?',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#contact').getBoundingClientRect().top<innerHeight);
    await page.setViewportSize({width:1440,height:900});await page.locator('.rs-brand').click();await page.getByRole('heading',{name:'The missing layer behind your work.'}).waitFor();
    await page.getByRole('link', { name: 'Get started', exact: true }).first().click(); await page.getByRole('heading', { name: 'Create your company' }).waitFor();
    await page.goto('http://127.0.0.1:5173/login'); assert(await page.locator('.v-auth-brand .vimbre-logo-full').isVisible()); await page.getByLabel('Work email').fill(user.email); await page.getByLabel('Password', { exact: true }).fill('test-record-password'); await page.getByRole('button', { name: 'Log in', exact: true }).click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert(await page.locator('.vw-brand-surface .vimbre-logo-full').isVisible()); assert.equal(await page.locator('.vw-brand-surface').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)'); assert.equal(await page.getByRole('button',{name:'Help',exact:true}).count(),0); await page.getByRole('link', { name: 'My role', exact: true }).click(); await page.getByRole('heading', { name: 'My role', exact: true }).waitFor();
    await page.getByLabel('Add to My role').waitFor();
    assert.deepEqual(await page.locator('.rc-section>summary>span:first-child').allTextContents(),['My work','Decisions','Contacts','Documents','Deadlines']);
    const add=async(kind)=>{await page.getByLabel('Add to My role').click();await page.locator('.rc-add').getByRole('button',{name:kind,exact:true}).click();return page.getByRole('dialog')};
    let editor=await add('Work');await editor.getByLabel('Title',{exact:true}).fill('Weekly review');await editor.getByLabel('What it involves',{exact:true}).fill('Read supplier reports');await editor.getByLabel('How often',{exact:true}).selectOption('Weekly');await editor.getByLabel('Steps',{exact:true}).fill('Read, check, then send');
    roleFixture.state.failSave=true;await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.getByRole('alert').waitFor();assert.equal(await editor.getByLabel('Title',{exact:true}).inputValue(),'Weekly review');roleFixture.state.failSave=false;await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.waitFor({state:'hidden'});await page.getByRole('button').filter({hasText:'Weekly review'}).waitFor();
    editor=await add('Decision');await editor.getByLabel('Title',{exact:true}).fill('Keep weekly reviews');await editor.getByLabel('Why',{exact:true}).fill('Track delivery');await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.waitFor({state:'hidden'});
    await page.locator('.rc-row-open').filter({hasText:'Keep weekly reviews'}).click();editor=page.getByRole('dialog');await editor.getByRole('button',{name:'Replace this decision',exact:true}).click();await editor.getByLabel('Title',{exact:true}).fill('Use monthly reviews');await editor.getByLabel('Why',{exact:true}).fill('Stable service');await editor.getByRole('button',{name:'Save replacement',exact:true}).click();await editor.waitFor({state:'hidden'});assert.equal(roleFixture.state.decisions[1].status,'replaced');
    for(const [kind,title,field,value] of [['Contact','Ada Supplier','Email or phone','ada@example.invalid'],['Document','Review guide','Link','https://example.invalid/guide'],['Deadline','Send report','Date','2026-11-06']]){editor=await add(kind);await editor.getByLabel(kind==='Contact'?'Name':'Title',{exact:true}).fill(title);await editor.getByLabel(field,{exact:true}).fill(value);await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.waitFor({state:'hidden'});}
    await page.getByLabel('Add a note',{exact:true}).fill('Private reminder');await page.getByRole('heading',{name:'Notes',exact:true}).click();await page.getByLabel('Note',{exact:true}).waitFor();assert.equal(roleFixture.state.note_entries[0].include_in_handover,false);
    await page.getByRole('button',{name:'Preview as cover',exact:true}).click();editor=page.getByRole('dialog');await editor.locator('.rc-guide').waitFor();assert(!(await editor.textContent()).includes('Private reminder'));assert((await editor.textContent()).includes('Use monthly reviews'));await page.keyboard.press('Escape');
    await page.locator('.rc-row').filter({hasText:'Weekly review'}).getByLabel('More for Weekly review',{exact:true}).click();await page.locator('.rc-row').filter({hasText:'Weekly review'}).getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();await page.locator('.rc-row-open').filter({hasText:'Weekly review'}).waitFor();
    roleFixture.state.failRead=true;await page.reload();await page.getByRole('button',{name:'Retry role'}).waitFor();roleFixture.state.failRead=false;await page.getByRole('button',{name:'Retry role'}).click();await page.getByLabel('Add to My role').waitFor();
    for(let i=0;i<12;i++)roleFixture.state.items.push({id:'extra-'+i,kind:'responsibility',title:'Responsibility '+i,role_fields:{recurrence:'Weekly'},deleted_at:null});await page.reload();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('11–13 of 13',{exact:true}).waitFor();
    for(const width of [320,360,390,430,640,768,820,834,1024,1180,1280,1366,1440,1920]){await page.setViewportSize({width,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`Role overflow ${width}`);if([360,768,1440].includes(width))await page.screenshot({path:`/tmp/vimbre-landing-role-client-${width}.png`,fullPage:true,animations:'disabled'});}
    await page.setViewportSize({width:360,height:800});editor=await add('Work');assert(!await editor.evaluate(el=>el.scrollWidth>el.clientWidth));assert.equal(await editor.getByLabel('Title',{exact:true}).getAttribute('spellcheck'),'true');await page.keyboard.press('Escape');
    roleFixture.state.own=false;roleFixture.state.notes='';await page.reload();await page.getByText('Viewing Record Owner’s role. Read only.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Add to My role').count(),0);assert.equal(await page.getByLabel('Add a note',{exact:true}).count(),0);
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('link', { name: 'Back to website', exact: true }).click(); await page.getByRole('heading', { name: 'The missing layer behind your work.', exact: true }).waitFor(); await page.setViewportSize({ width: 360, height: 800 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'signed-in public header overflow'); await page.setViewportSize({ width: 1440, height: 900 }); assert.equal(await page.getByRole('link', { name: 'Log in', exact: true }).count(), 0); await page.reload(); await page.getByRole('link', { name: 'Open workspace', exact: true }).first().click(); await page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / }).waitFor(); assert.equal(new URL(page.url()).pathname, '/app'); await page.goto('http://127.0.0.1:5173/signup'); await page.getByRole('heading', { name: 'Create your company', exact: true }).waitFor();
    await page.goto('http://127.0.0.1:5173/'); await page.emulateMedia({ reducedMotion: 'reduce' }); assert.equal(await page.locator('.rs-hero').evaluate(el => getComputedStyle(el).animationName), 'none'); await page.screenshot({ path: '/tmp/vimbre-landing-desktop.png', fullPage: true });
    assert.equal(errors.length, 0, JSON.stringify(errors)); console.log(JSON.stringify({ publicEntryAndWorkspace: 'passed', fiveRecordCategories: 'passed', decisionWorkstreamStatusLinks: 'passed', archiveRestoreReload: 'passed', failedSaveRetainsDraft: 'passed', readRetry: 'passed', pagination: 'passed', holderEditingAndManagerReadOnly: 'passed', stableDecisionLinks: 'passed', privateNotesAndHandover: 'passed', mobileOverflow: false, pageErrors: errors, network: 'intercepted; no real user data created' }));
  } catch(error) { for(const context of browser.contexts()) for(const p of context.pages()){await p.screenshot({path:'/tmp/vimbre-landing-role-client-failure.png',fullPage:true}).catch(()=>{});console.log('Visible dialogs:',await p.getByRole('dialog').allTextContents())} throw error;} finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });


