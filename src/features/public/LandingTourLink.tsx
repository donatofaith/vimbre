import type {ReactNode} from 'react'
import {Link} from 'react-router-dom'
export function LandingTourLink({children='Take the product tour →'}:{children?:ReactNode}){
 return <Link className="rs-text-link" to="/#product-demo" onClick={()=>{
  window.dispatchEvent(new Event('vimbre:tour-start'))
  const preview=document.getElementById('product-demo')
  if(preview)preview.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})
 }}>{children}</Link>
}
