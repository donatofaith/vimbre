import {refreshQueue} from '../my-day/refresh-queue'
export const WORKSPACE_REFRESH_MS=30_000
const subscribers=new Set<()=>void>()
let stop:(()=>void)|undefined
/** One visible, online workspace clock; no page reloads or automatic AI requests. */
export function subscribeWorkspaceRefresh(refresh:()=>void|Promise<unknown>){
 const queue=refreshQueue(async()=>{try{await refresh()}catch{/* Keep the last good view; loaders report their own errors. */}})
 const schedule=()=>queue.schedule()
 subscribers.add(schedule)
 if(!stop){
  const notify=()=>{if(!document.hidden&&navigator.onLine)for(const subscriber of subscribers)subscriber()}
  const timer=setInterval(notify,WORKSPACE_REFRESH_MS)
  const events=['focus','online','vimbre:work-changed','vimbre:profile-updated']
  for(const event of events)window.addEventListener(event,notify)
  document.addEventListener('visibilitychange',notify)
  stop=()=>{clearInterval(timer);for(const event of events)window.removeEventListener(event,notify);document.removeEventListener('visibilitychange',notify)}
 }
 return()=>{queue.dispose();subscribers.delete(schedule);if(!subscribers.size){stop?.();stop=undefined}}
}
