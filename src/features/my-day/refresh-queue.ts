/** Coalesce focus/visibility/mutation bursts; run one trailing read after an in-flight change. */
export function refreshQueue(load:()=>Promise<unknown>,delay=120){let timer:ReturnType<typeof setTimeout>|undefined,running=false,again=false,disposed=false
 async function run(){if(disposed)return;if(running){again=true;return}running=true;try{await load()}finally{running=false;if(again&&!disposed){again=false;schedule()}}}
 function schedule(){if(disposed)return;if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=undefined;void run()},delay)}
 return{run,schedule,dispose(){disposed=true;again=false;if(timer)clearTimeout(timer)}}
}
