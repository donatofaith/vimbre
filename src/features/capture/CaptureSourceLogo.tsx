import type {ReactNode} from 'react'
/** Brand marks stay vector based and inherit neither text colour nor letter placeholders. */
export function CaptureSourceLogo({provider}:{provider:string}){
 let mark:ReactNode
 if(provider==='gmail')mark=<><path fill="#4285f4" d="M2 7v13h4V10z"/><path fill="#34a853" d="M18 10v10h4V7z"/><path fill="#ea4335" d="m2 5 10 8L22 5v5l-10 8L2 10z"/><path fill="#fbbc04" d="M18 8 22 5v5l-4 3z"/><path fill="#c5221f" d="M2 5v5l4 3V8z"/></>
 else if(provider==='drive')mark=<><path fill="#0f9d58" d="m8 2 5 9-5 9H2l-2-4z"/><path fill="#f4b400" d="m8 2 6 0 10 16-6 0z"/><path fill="#4285f4" d="m6 14 18 0-3 6H2z"/></>
 else if(provider==='slack')mark=<><g fill="#36c5f0"><rect x="2" y="8" width="9" height="4" rx="2"/><rect x="7" y="2" width="4" height="5" rx="2"/></g><g fill="#2eb67d"><rect x="13" y="2" width="4" height="9" rx="2"/><rect x="18" y="7" width="4" height="4" rx="2"/></g><g fill="#ecb22e"><rect x="13" y="13" width="9" height="4" rx="2"/><rect x="13" y="18" width="4" height="4" rx="2"/></g><g fill="#e01e5a"><rect x="7" y="13" width="4" height="9" rx="2"/><rect x="2" y="13" width="4" height="4" rx="2"/></g></>
 else if(provider==='trello')mark=<><rect x="2" y="2" width="20" height="20" rx="4" fill="#0052cc"/><g fill="white"><rect x="6" y="6" width="5" height="12" rx="1"/><rect x="13" y="6" width="5" height="8" rx="1"/></g></>
 else if(provider==='teams')mark=<><g fill="#7b83eb"><circle cx="16" cy="5" r="3"/><circle cx="21" cy="8" r="2"/><path d="M12 10h11v7a4 4 0 0 1-8 0z"/></g><rect x="1" y="7" width="14" height="14" rx="2" fill="#464eb8"/><path stroke="white" strokeWidth="1.8" d="M5 11h6m-3 0v7"/></>
 else if(provider==='outlook')mark=<><rect x="7" y="3" width="15" height="18" rx="2" fill="#0078d4"/><path fill="#50d9ff" d="m8 10 7 6 7-6v9H8z"/><rect x="1" y="6" width="12" height="15" rx="1" fill="#0364b8"/><ellipse cx="7" cy="13.5" rx="3" ry="4" fill="none" stroke="white" strokeWidth="1.5"/></>
 else mark=<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{provider==='upload'?<><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>:provider==='email'?<><rect x="2" y="5" width="20" height="15" rx="2"/><path d="m2 6 10 8L22 6"/></>:<><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6m-6 4h6"/></>}</g>
 return <svg className="vc-source-logo" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">{mark}</svg>
}
