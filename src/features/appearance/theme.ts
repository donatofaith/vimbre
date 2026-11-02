export type WorkspaceTheme='light'|'dark'
export const themeKey='vimbre:workspace-theme:v1'
const event='vimbre:workspace-theme'
let temporary:WorkspaceTheme|undefined
export function workspaceTheme():WorkspaceTheme{
 if(typeof window==='undefined')return 'light'
 try{const stored=window.localStorage.getItem(themeKey);if(stored==='light'||stored==='dark')return stored}catch{/* Use memory when storage is unavailable. */}
 if(temporary)return temporary
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'
}
export function setWorkspaceTheme(theme:WorkspaceTheme){
 temporary=theme
 try{window.localStorage.setItem(themeKey,theme)}catch{/* The active session still changes theme. */}
 window.dispatchEvent(new Event(event))
}
export function subscribeTheme(change:()=>void){
 const storage=(e:StorageEvent)=>{if(e.key===themeKey||e.key===null){temporary=undefined;change()}}
 const media=window.matchMedia?.('(prefers-color-scheme: dark)')
 window.addEventListener(event,change);window.addEventListener('storage',storage);media?.addEventListener('change',change)
 return()=>{window.removeEventListener(event,change);window.removeEventListener('storage',storage);media?.removeEventListener('change',change)}
}
