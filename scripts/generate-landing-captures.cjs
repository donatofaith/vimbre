// Actual product UI with isolated sample records. All API responses are intercepted.
const {start}=require('./capture-browser-fixture.cjs');
const {randomUUID}=require('node:crypto');
(async()=>{
 const f=await start('chromium',{viewport:{width:1100,height:1000},reducedMotion:'reduce'});
 try{
  const p=f.page,id=randomUUID();
  const text='Alex will share review notes by 12 Nov 2026. Sam will schedule the monthly review for 16 Nov 2026. Alex will update the agenda by 20 Nov 2026.';
  await p.getByLabel('Paste the conversation.',{exact:true}).fill(text);
  await p.locator('.vc-compose').screenshot({path:'public/product/capture-source.png'});
  f.state.sources.push({id,title:'Monthly supplier reviews',source_text:text,channel:'paste',source_date:'2026-11-09',status:'drafts_ready',draft_attempts:1,deleted_at:null});
  f.state.items=[['Share the review notes','12','Alex'],['Schedule the monthly supplier review','16','Sam'],['Update the supplier review agenda','20','Alex']].map(([title,day,owner])=>({id:randomUUID(),capture_id:id,kind:'action',origin:'ai',status:'pending',version:1,payload:{title,due_date:'2026-11-'+day,owner_id:f.user.id,source_owner:owner,source_excerpt:text,details:'From the supplier review conversation.'}}));
  await p.reload();await p.getByRole('button',{name:/Monthly supplier reviews/}).click();
  await p.getByRole('button',{name:/Update the supplier review agenda Me/}).waitFor();
  await p.addStyleTag({content:'.vc-draft-title>span,.vc-review-card .vc-note{filter:blur(3px)}'});
  await p.locator('.vc-review-grid').screenshot({path:'public/product/capture-review.png'});
  await p.getByRole('button',{name:/Share the review notes Me/}).click();
  await p.getByRole('heading',{name:'Share the review notes',exact:true}).waitFor();
  await p.locator('.vc-review-grid').screenshot({path:'public/product/capture-check.png'});
  console.log('Actual Capture source, drafts and review captured with sample data. No model or provider requests.');
 }finally{await f.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
