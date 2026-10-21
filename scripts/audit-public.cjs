const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  for(const address of ['https://vimbre.co.uk/','https://www.vimbre.co.uk/','https://vimbre.com/','https://www.vimbre.com/']){
    try{
      const response=await fetch(address,{redirect:'manual',signal:AbortSignal.timeout(15000)});
      const html = response.status === 200 ? await response.text() : '';
      console.log('DOMAIN_CHECK '+JSON.stringify({address,status:response.status,location:response.headers.get('location'),currentLanding:html.includes('Someone leaving or away?'),socialImage:html.includes('vimbre-og-image-1200.png'),server:response.headers.get('server')}));
    }catch(error){console.log('DOMAIN_CHECK '+JSON.stringify({address,error:error.message}));}
  }
  const url='https://vimbre.vercel.app/';
  let current=false;
  for(let attempt=0;attempt<12;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
      const html=await response.text();
      current=response.ok && html.includes('Someone leaving or away?') && html.includes('vimbre-og-image-1200.png');
      if(current)break;
    }catch{}
    await delay(10000);
  }
  if(!current)throw new Error('Current prerendered homepage is not yet available on production.');
  console.log('LIVE_HTML '+JSON.stringify({url,prerender:true}));
  const exitCode=await new Promise((resolve,reject)=>{
    const child=spawn('npx',['--yes','lighthouse@13.0.1',url,'--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage','--output=json','--output-path=/tmp/vimbre-lighthouse.json','--quiet'],{stdio:'inherit',env:{...process.env,CHROME_PATH:chromium.executablePath()}});
    child.on('error',reject);child.on('close',resolve);
  });
  if(exitCode!==0)throw new Error('Lighthouse did not finish: '+exitCode);
  const report=JSON.parse(await readFile('/tmp/vimbre-lighthouse.json','utf8'));
  const scores=Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,Math.round(value.score*100)]));
  const metrics=Object.fromEntries(['largest-contentful-paint','cumulative-layout-shift','total-blocking-time','interactive'].flatMap(key=>report.audits[key]?[[key,report.audits[key].numericValue]]:[]));
  const findings=Object.entries(report.audits).filter(([,a])=>a.score!==null&&a.score<1).map(([id,a])=>({id,score:a.score,title:a.title,detail:a.displayValue,items:a.details?.items?.slice(0,4)}));
  console.log('LIGHTHOUSE_RESULT '+JSON.stringify({url,scores,metrics,findings}));
})().catch(error=>{console.error(error);process.exitCode=1});

