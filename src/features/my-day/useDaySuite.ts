import {refreshQueue} from './refresh-queue'
import {useEffect,useState} from 'react'
import {daySuite} from './suite-api'
import type {SuiteOverview} from './suite-api'
export function useDaySuite(owner:string,revision:number){
 const [state,setState]=useState<{owner:string;data:SuiteOverview|null;error:boolean}|null>(null),[retry,setRetry]=useState(0)
 useEffect(()=>{let live=true,version=0;async function load(){const n=++version;try{const data=await daySuite<SuiteOverview>('overview');if(!data||!Array.isArray(data.incoming)||!Array.isArray(data.waiting)||!data.settings||!data.flags)throw Error();if(live&&n===version)setState({owner,data,error:false})}catch{if(live&&n===version)setState({owner,data:null,error:true})}}const queued=refreshQueue(load);void queued.run();const refresh=()=>{if(!document.hidden&&navigator.onLine)queued.schedule()};window.addEventListener('vimbre:work-changed',refresh);window.addEventListener('focus',refresh);return()=>{live=false;queued.dispose();window.removeEventListener('vimbre:work-changed',refresh);window.removeEventListener('focus',refresh)}},[owner,revision,retry])
 return {data:state?.owner===owner?state.data:null,error:state?.owner===owner&&state.error,retry:()=>setRetry(n=>n+1)}
}
