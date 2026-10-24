const {spawnSync}=require('node:child_process');
let failed=false;
for(const suite of ['support','handover','capture','my-day','landing','chat','','team','records','actions','ai']){
 const script=`scripts/check-${suite?suite+'-':''}browser.cjs`;
 const result=spawnSync(process.execPath,[script],{stdio:'inherit'});
 if(result.status!==0){failed=true;console.error(`FAILED: ${script}`)}
}
process.exit(failed?1:0);
