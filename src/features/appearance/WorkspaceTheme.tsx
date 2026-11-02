import {useLayoutEffect,useSyncExternalStore} from 'react'
import {useLocation}from 'react-router-dom'
import {workspaceTheme,setWorkspaceTheme,subscribeTheme}from './theme'
import './workspace-theme.generated.css'
import './workspace-theme.css'
const serverTheme=()=>'light' as const
export function WorkspaceThemeRoute(){
 const {pathname}=useLocation()
 const theme=useSyncExternalStore(subscribeTheme,workspaceTheme,serverTheme)
 useLayoutEffect(()=>{
  const root=document.documentElement
  const workspace=/^\/app(?:\/|$)/.test(pathname)
  if(workspace)root.dataset.workspaceTheme=theme;else delete root.dataset.workspaceTheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',workspace&&theme==='dark'?'#0b1624':'#102a43')
 },[pathname,theme])
 return null
}
export function WorkspaceThemeToggle(){
 const theme=useSyncExternalStore(subscribeTheme,workspaceTheme,serverTheme)
 const label=theme==='dark'?'Switch to light mode':'Switch to dark mode'
 return <button type="button"className="chat-launcher workspace-theme-toggle"aria-label={label}title={label}onClick={()=>setWorkspaceTheme(theme==='dark'?'light':'dark')}><svg viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.7"strokeLinecap="round"strokeLinejoin="round"aria-hidden="true">{theme==='dark'?<><circle cx="12"cy="12"r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>:<path d="M20.7 13.2A8.6 8.6 0 0 1 10.8 3.3 8.7 8.7 0 1 0 20.7 13.2Z"/>}</svg></button>
}
