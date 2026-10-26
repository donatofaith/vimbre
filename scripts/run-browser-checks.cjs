const {spawnSync}=require('node:child_process');
let failed=false;
for(const suite of ['myday-suite','myday-pwa','connections','responsive','support','handover','capture','my-day','landing','chat','','team','records','actions','ai']){
 const script=`scripts/check-${suite?suite+'-':''}browser.cjs`;
 const result=spawnSync(process.execPath,[script],{stdio:'inherit'});
 if(result.status!==0){failed=true;console.error(`FAILED: ${script}`);if(suite.startsWith('myday'))break}
}
const safari=failed?{status:0}:spawnSync(process.execPath,['scripts/check-myday-suite-browser.cjs'],{stdio:'inherit',env:{...process.env,VIMBRE_BROWSER:'webkit'}});if(safari.status!==0){failed=true;console.error('FAILED: My Day suite in WebKit')}
process.exit(failed?1:0);
