const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
(async()=>{
 const fixture=await require('./capture-browser-fixture.cjs').start(process.env.VIMBRE_BROWSER||'chromium');
 const {page,state,profile,user}=fixture;
 try{
  await page.addInitScript(()=>localStorage.setItem('vimbre:analytics-consent:v1','declined'));
  const today=new Date().toISOString().slice(0,10);
  const task={id:randomUUID(),owner_id:user.id,title:'Review supplier quote',status:'open',due_date:today,due_time:null,priority:'normal',source_kind:'manual',details:'Compare totals',deleted_at:null,updated_at:new Date().toISOString(),steps:[],links:[]};
  let saved=0,deleted=0;
  await page.route('**/rest/v1/rpc/myday_tasks',r=>r.fulfill({json:{rows:task.deleted_at?[]:[task],count:task.deleted_at?0:1,today,timezone:'Africa/Lagos',counts:{today:1,overdue:0},done_today:[],upcoming:[],overdue_rows:[],context_waiting:[],covering:[],cover_tasks:[],has_work:true,checklist:{capture:true,role:true,reminder:true,cover:true}}}));
  await page.route('**/rest/v1/rpc/myday_suite',r=>{const a=r.request().postDataJSON();return r.fulfill({json:a.p_operation==='overview'?{settings:{},flags:{},incoming:[],waiting:[],notifications:[],away:[]}:a.p_operation==='task_extra'?{files:[],decisions:[],repeat:null,assignment:null}:[]})});
  await page.route('**/rest/v1/rpc/myday_edit',r=>{const a=r.request().postDataJSON();assert.equal(a.p_id,task.id);assert(a.p_data.base_updated_at);Object.assign(task,a.p_data,{updated_at:new Date().toISOString()});saved++;return r.fulfill({json:{updated_at:task.updated_at}})});
  await page.route('**/rest/v1/rpc/myday_action',r=>{const a=r.request().postDataJSON();if(a.p_operation==='archive'){task.deleted_at=new Date().toISOString();deleted++}return r.fulfill({json:task.id})});
  await page.goto('http://127.0.0.1:5173/app');
  await page.getByRole('button',{name:task.title,exact:true}).click();
  await page.getByRole('button',{name:'Edit task',exact:true}).click();
  let panel=page.getByRole('dialog');await panel.waitFor();
  const remove=panel.getByRole('button',{name:'Delete',exact:true}),save=panel.getByRole('button',{name:'Save changes',exact:true});
  for(const width of [320,360,768,1024,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await remove.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(180, 35, 24)');
   assert.equal(await save.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 99, 217)');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+width);
   await save.scrollIntoViewIfNeeded();const b=await save.boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width+1);
   if([360,1440].includes(width))await page.screenshot({path:`/tmp/vimbre-action-colours-${process.env.VIMBRE_BROWSER||'chromium'}-${width}.png`,fullPage:true});
  }
  await panel.getByLabel('What needs to be done?',{exact:true}).fill('Review updated supplier quote');await save.click();
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(saved,1);assert.equal(task.title,'Review updated supplier quote');
  await page.getByRole('button',{name:task.title,exact:true}).click();await page.getByRole('button',{name:'Edit task',exact:true}).click();panel=page.getByRole('dialog');
  await panel.getByRole('button',{name:'Delete',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));assert.equal(deleted,1);
  const colleague={...profile,id:randomUUID(),full_name:'Casey Colleague',email:'casey@example.invalid',role:'employee',employment_status:'active',department:null};let suspended=0;
  await page.route('**/rest/v1/profiles?*',r=>{const single=r.request().headers().accept?.includes('vnd.pgrst.object');return r.fulfill({json:single?profile:[{...profile,department:null},colleague],headers:{'content-range':'0-1/2'}})});
  await page.route('**/rest/v1/invitations?*',r=>r.fulfill({json:[],headers:{'content-range':'*/0'}}));
  await page.route('**/rest/v1/rpc/set_member_status',r=>{const a=r.request().postDataJSON();assert.equal(a.p_id,colleague.id);assert.equal(a.p_status,'suspended');suspended++;colleague.active=false;colleague.employment_status='suspended';return r.fulfill({json:null})});
  await page.goto('http://127.0.0.1:5173/app/team');
  const row=page.getByRole('row').filter({hasText:'Casey Colleague'});await row.locator('summary').click();
  const suspend=row.getByRole('button',{name:'Suspend',exact:true});
  for(const width of [320,360,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await suspend.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 244, 214)');assert.equal(await row.getByRole('button',{name:'Dismiss',exact:true}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(180, 35, 24)');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  page.once('dialog',dialog=>dialog.accept());await suspend.click();await page.getByText('Member status updated.',{exact:true}).waitFor();assert.equal(suspended,1);
  assert.equal(state.calls.filter(c=>c.path.endsWith('/ai-run')).length,0);assert.deepEqual(state.errors,[]);
  console.log('Task save/delete, guarded team suspension, action colours and responsive layouts passed. All backend calls intercepted.');
 }catch(error){await page.screenshot({path:'/tmp/vimbre-action-colours-error.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-3500));throw error}finally{await fixture.close()}
})().catch(error=>{console.error(error);process.exit(1)});
