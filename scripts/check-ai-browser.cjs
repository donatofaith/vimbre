const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host:'127.0.0.1', port:5173, strictPort:true } }); await server.listen();
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}}); page.setDefaultTimeout(10000);
    const errors=[]; page.on('pageerror', error=>errors.push(error.message));
    const user={id:'11111111-1111-4111-8111-111111111111',email:'ai-fixture@example.invalid',role:'authenticated',aud:'authenticated',email_confirmed_at:new Date().toISOString(),app_metadata:{},user_metadata:{}};
    const company={id:'22222222-2222-4222-8222-222222222222',name:'AI fixture',team_mode:'small',created_by:user.id};
    const profile={id:user.id,company_id:company.id,full_name:'Alex Example',email:user.email,active:true,role:'hr_admin',department_id:null};
    const calls=[], writes=[]; let limited=false; let allowance=null;
    await page.route('https://*.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url());let args={};try{args=request.postDataJSON()||{}}catch{}
      const call={path:url.pathname,method:request.method(),params:Object.fromEntries(url.searchParams),args};calls.push(call);
      let body={},status=200;
      if(url.pathname.endsWith('/token'))body={access_token:'ai-fixture-token',refresh_token:'ai-fixture-refresh',token_type:'bearer',expires_in:3600,user};
      else if(url.pathname.endsWith('/user'))body=user;
      else if(url.pathname.endsWith('/profiles'))body=request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
      else if(url.pathname.endsWith('/companies'))body=company;
      else if(url.pathname.endsWith('/my_invitation'))body=[];
      else if(url.pathname.endsWith('/company_active_member_count'))body=1;
      else if(url.pathname.endsWith('/work_notification_inbox'))body={unread:0,count:0,items:[]};
      else if(url.pathname.endsWith('/ai_allowance_summary'))body=allowance;
      else if(url.pathname.endsWith('/my_day_summary'))body={pending_drafts:0,completed_sections:[],forwarding_address:null};
      else if(url.pathname.endsWith('/ai-run')){status=limited?429:200;body=limited?{ok:false,code:'limit_reached',message:'Your company has reached its AI limit. You can continue by hand.',can_continue_manually:true}:{ok:true,request_id:'fixture',text:args.task.startsWith('role_')?JSON.stringify({items:[{title:'Supplier reviews',details:'Review supplier notes each Friday.',recurrence:'Weekly'}]}):args.task==='tasks_extract'?JSON.stringify({items:[{title:'Send supplier notes',details:'Share the review',due_date:'2026-10-23'}]}):args.task==='tidy_text'?'Review supplier notes each Friday.':args.task==='weekly_summary'?'Recent decisions\nSupplier reviews are monthly.':'Responsibilities\nReview supplier notes.\n\nOpen work\nShare the review notes.'};}
      else if(url.pathname.endsWith('/role_items')){if(request.method()==='POST'){writes.push(call);body={id:'new-fixture-record'}}else body=url.searchParams.get('select')==='*'||url.searchParams.has('kind')?[]:[{kind:'responsibility',title:'Supplier reviews',details:'Review supplier notes',due_date:null}];}
      else if(url.pathname.endsWith('/decisions'))body=[{title:'Monthly supplier reviews',reason:'Reduce meetings',decided_on:'2026-10-20',decided_by:'Operations',next_step:'Share the notes'}];
      else if(url.pathname.endsWith('/actions'))body=[];
      else if(url.pathname.endsWith('/responsibility_suggestions'))body=[];
      await route.fulfill({status,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':'*/0'},body:JSON.stringify(body)});
    });
    await page.goto('http://127.0.0.1:5173/login');await page.getByLabel('Work email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('Fixture-password-123');await page.getByRole('button',{name:'Log in',exact:true}).click();
    await page.getByRole('heading',{name:/^Good (morning|afternoon|evening),/}).waitFor();
    await page.getByRole('button',{name:'Weekly summary',exact:true}).click();
    const summary=page.getByRole('dialog',{name:'Weekly summary',exact:true});await summary.getByRole('button',{name:'Use my records',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('dialog textarea')?.value.includes('Supplier reviews'));
    assert((await summary.getByLabel('Notes to use',{exact:true}).inputValue()).includes('Reduce meetings'));
    await summary.getByRole('button',{name:'Generate draft',exact:true}).click();await summary.getByLabel('Draft',{exact:true}).waitFor();assert((await summary.getByLabel('Draft',{exact:true}).inputValue()).includes('Recent decisions'));
    assert.equal(writes.length,0,'Summary generation must not save records');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
    await page.goto('http://127.0.0.1:5173/app/role-record');await page.getByRole('button',{name:'Use Vimbre AI',exact:true}).click();
    const tidy=page.getByRole('dialog',{name:'Use Vimbre AI',exact:true});await tidy.getByLabel('Job title, job description or notes',{exact:true}).fill('review supplier notes each friday');await tidy.getByRole('button',{name:'Generate drafts',exact:true}).click();
    await tidy.getByText('Draft from Vimbre AI. Check before saving.',{exact:true}).waitFor();assert.equal(writes.length,0);await tidy.getByRole('button',{name:'Review draft',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Add a responsibility',exact:true});assert.equal(await editor.getByLabel('What it involves',{exact:true}).inputValue(),'Review supplier notes each Friday.');await editor.getByLabel('Title',{exact:true}).fill('Supplier reviews');
    assert.equal(writes.length,0,'Applying a revision must still require Save');await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.waitFor({state:'hidden'});assert.equal(writes.length,1);
    await page.goto('http://127.0.0.1:5173/app');await page.getByRole('button',{name:'Use Vimbre AI',exact:true}).click();
    const tasks=page.getByRole('dialog',{name:'Use Vimbre AI',exact:true});await tasks.getByLabel('Email or notes',{exact:true}).fill('Send supplier notes by 23 October 2026');await tasks.getByRole('button',{name:'Generate drafts',exact:true}).click();await tasks.getByRole('button',{name:'Review draft',exact:true}).click();
    assert.equal(await page.getByLabel('What needs to be done?',{exact:true}).inputValue(),'Send supplier notes');assert.equal(await page.getByLabel('Due date',{exact:true}).inputValue(),'2026-10-23');assert.equal(writes.length,1);await page.getByRole('button',{name:'Cancel edit',exact:true}).click();
    await page.goto('http://127.0.0.1:5173/app/handovers');await page.getByRole('heading',{name:'Handovers',exact:true}).waitFor();
    await page.getByRole('button',{name:'Use my records',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main textarea')?.value.includes('Supplier reviews'));
    await page.getByRole('button',{name:'Generate draft',exact:true}).click();await page.getByLabel('Draft',{exact:true}).waitFor();assert((await page.getByLabel('Draft',{exact:true}).inputValue()).includes('Responsibilities'));
    assert.equal(writes.length,1,'Handover draft must not publish or save itself');await page.getByRole('button',{name:'Discard draft',exact:true}).click();
    limited=true;await page.getByRole('button',{name:'Generate draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'AI limit'}).waitFor();await page.getByRole('button',{name:'Write draft manually',exact:true}).click();await page.getByLabel('Draft',{exact:true}).fill('Manual handover notes stay editable.');assert.equal(await page.getByLabel('Draft',{exact:true}).inputValue(),'Manual handover notes stay editable.');
    await page.getByRole('link',{name:'Contact support',exact:true}).waitFor();
    allowance={enabled:true,warning:true,blocked:false,period:'day',daily_percent:80,monthly_percent:10,daily_reset_at:'2026-10-23T00:00:00Z',monthly_reset_at:'2026-11-01T00:00:00Z'};
    await page.evaluate(()=>window.dispatchEvent(new Event('vimbre:ai-usage')));
    const quota=page.getByRole('status').filter({hasText:'80% of its daily AI allowance'});await quota.waitFor();
    allowance={...allowance,blocked:true,period:'month',daily_percent:80,monthly_percent:100};
    await page.evaluate(()=>window.dispatchEvent(new Event('vimbre:ai-usage')));
    await page.getByRole('status').filter({hasText:'AI drafts are paused until 1 November 2026'}).waitFor();
    assert.equal(await page.getByLabel('Draft',{exact:true}).inputValue(),'Manual handover notes stay editable.');
    for(const call of calls.filter(c=>c.path.endsWith('/ai-run'))){assert.deepEqual(Object.keys(call.args).sort(),['task','text']);assert(['role_responsibility','tasks_extract','tidy_text','weekly_summary','handover_draft'].includes(call.args.task));}
    for(const call of calls.filter(c=>c.params.limit==='100')){assert.equal(call.params.owner_id,`eq.${user.id}`);assert.equal(call.params.company_id,`eq.${company.id}`);assert.equal(call.params.deleted_at,'is.null');assert(!call.params.select.includes('personal'));}
    assert.equal(calls.filter(c=>/capture_detail|capture_list|responsibility_notes/.test(c.path)).length,0,'Summary context must not load private notes or original sources');
    for(const width of [360,768,1024,1440]){await page.setViewportSize({width,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`AI page overflow at ${width}`);}
    await page.screenshot({path:'/tmp/vimbre-landing-ai-handover.png',fullPage:true});
    profile.role='employee';await page.reload();await page.getByRole('heading',{name:'Handovers',exact:true}).waitFor();assert.equal(await page.getByRole('complementary',{name:'AI allowance',exact:true}).count(),0,'Employee has no admin allowance banner');
    assert.equal(errors.length,0,JSON.stringify(errors));console.log(JSON.stringify({weeklySummary:'passed',structuredReviewBeforeSave:'passed',handoverDraft:'passed',manualFallback:'passed',sourceScope:'passed',responsive:'passed',providerCalls:0}));
  }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exit(1)});
