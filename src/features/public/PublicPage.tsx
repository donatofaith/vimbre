import {useLocation} from 'react-router-dom'
import {useAuth} from '../auth/AuthProvider'
import {PublicFrame} from './PublicFrame'
import {FAQ,IntegrationList,Pricing} from './PublicSections'
import {publicPages} from './public-content'
import {schema} from './landing-content'
export function PublicPage(){
  const {session,loading}=useAuth()
  return <PublicPageContent authenticated={Boolean(session)} loading={loading}/>
}
export function PublicPageContent({path:given,authenticated=false,loading=false}:{path?:string;authenticated?:boolean;loading?:boolean}){const {pathname}=useLocation();const path=given??pathname;const page=publicPages[path];if(!page)return null;return <PublicFrame authenticated={authenticated} loading={loading}><section className="rs-section public-page-intro"><div className="rs-container"><p className="rs-eyebrow">Vimbre</p><h1 tabIndex={-1}>{page.heading}</h1><p className="public-lead">{page.intro}</p>{path==='/pricing'?<Pricing/>:path==='/faq'?<FAQ/>:path==='/integrations'?<IntegrationList/>:<div className="public-page-sections">{page.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>}</div></section>{['/pricing','/faq'].includes(path)&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':schema['@context'],'@graph':schema['@graph'].filter(x=>x['@type']!=='FAQPage'||path==='/faq')}).replace(/</g,'\\u003c')}}/>}</PublicFrame>}
