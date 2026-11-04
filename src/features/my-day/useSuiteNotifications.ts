import {subscribeWorkspaceRefresh} from '../workspace/workspace-refresh'
import {refreshQueue} from './refresh-queue'
import {useCallback,useEffect,useState} from 'react'
import {daySuite} from './suite-api'
import type {DayNotice} from './suite-api'
export function useSuiteNotifications(){const [rows,setRows]=useState<DayNotice[]>([]),[unread,setUnread]=useState(0),[error,setError]=useState(false),[revision,setRevision]=useState(0);const refresh=useCallback(()=>setRevision(v=>v+1),[]);useEffect(()=>{let live=true,request=0;async function load(){if(!navigator.onLine||document.hidden)return;const n=++request;try{const v=await daySuite<{rows:DayNotice[];unread:number}>('notifications');if(!Array.isArray(v.rows)||!Number.isSafeInteger(v.unread))throw Error();if(live&&n===request){setRows(v.rows);setUnread(v.unread);setError(false)}}catch{if(live&&n===request)setError(true)}}const queued=refreshQueue(load);void queued.run();const reload=()=>queued.schedule();const unsubscribe=subscribeWorkspaceRefresh(reload);return()=>{live=false;queued.dispose();unsubscribe()}},[revision]);return{rows,unread,error,refresh,read:async(id:string)=>{await daySuite('notification_read',id);refresh()}}}
