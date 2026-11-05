import {useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {daySuite} from './suite-api'
const pushChanged = 'vimbre:device-push-changed'
export async function isDevicePushEnabled() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration()
  return Boolean(await registration?.pushManager.getSubscription())
}
function subscribeDevicePush(check: () => void) {
  window.addEventListener(pushChanged, check)
  window.addEventListener('focus', check)
  document.addEventListener('visibilitychange', check)
  return () => {
    window.removeEventListener(pushChanged, check)
    window.removeEventListener('focus', check)
    document.removeEventListener('visibilitychange', check)
  }
}
export function useDevicePushEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let revision = 0
    function check() {
      if (document.hidden) return
      const current = ++revision
      void isDevicePushEnabled().catch(() => false).then(value => {
        if (current === revision) setEnabled(value)
      })
    }
    check()
    const unsubscribe = subscribeDevicePush(check)
    return () => { revision++; unsubscribe() }
  }, [])
  return [enabled, setEnabled] as const
}
const decode=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))
export async function registerPush(){if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Push is unavailable in this browser. On iPhone, add Vimbre to your Home Screen first.');if(await Notification.requestPermission()!=='granted')throw Error('Allow notifications in your browser settings to register this device.');const registration=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('Reload Vimbre while connected, then register this device.')),15000))]);const {data,error}=await supabase.functions.invoke('myday-device',{body:{},signal:AbortSignal.timeout(15000)});if(error||!data?.public_key)throw Error('Device registration is unavailable. Try again.');const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(data.public_key)});try{await daySuite('push_register',null,subscription.toJSON() as Record<string,unknown>);await daySuite('preferences',null,{push:true});const {data:{user}}=await supabase.auth.getUser();registration.active?.postMessage({type:'PUSH_ACCOUNT',owner:user?.id??''});window.dispatchEvent(new Event(pushChanged))}catch(e){await subscription.unsubscribe();throw e}}
export async function clearDevicePush(){if(!('serviceWorker' in navigator))return;const registration=await navigator.serviceWorker.getRegistration();registration?.active?.postMessage({type:'PUSH_ACCOUNT',owner:''});const subscription=await registration?.pushManager.getSubscription();if(subscription){try{await daySuite('push_unregister',null,{endpoint:subscription.endpoint})}catch{/* Unsubscription also revokes this browser's endpoint. */}await subscription.unsubscribe();window.dispatchEvent(new Event(pushChanged))}for(const notification of await registration?.getNotifications()??[])notification.close()}
