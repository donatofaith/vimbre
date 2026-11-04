import {Link,useLocation} from 'react-router-dom'
import {PublicFrame} from './PublicFrame'
import {FAQ,IntegrationList,Pricing} from './PublicSections'
import {publicPages} from './public-content'
import {LandingTourLink} from './LandingTourLink'
import {schema} from './landing-content'
import {trackMarketing} from './marketing-analytics'
export function PublicPage({path:given}:{path?:string}){const {pathname}=useLocation();const path=given??pathname;const page=publicPages[path];if(!page)return null;return <PublicFrame><section className="rs-section public-page-intro"><div className="rs-container"><p className="rs-eyebrow">Vimbre</p><h1 tabIndex={-1}>{page.heading}</h1><p className="public-lead">{page.intro}</p>{path==='/pricing'?<Pricing/>:path==='/faq'?<FAQ/>:path==='/integrations'?<IntegrationList/>:<div className="public-page-sections">{page.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}</div>}{!['/for-individuals','/for-founders','/for-companies'].includes(path)&&<div className="rs-actions"><Link className="rs-button" to="/signup" onClick={()=>trackMarketing('cta_click',{location:'final'})}>Get started →</Link><LandingTourLink/></div>}</div></section>{['/pricing','/faq'].includes(path)&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':schema['@context'],'@graph':schema['@graph'].filter(x=>x['@type']!=='FAQPage'||path==='/faq')}).replace(/</g,'\\u003c')}}/>}</PublicFrame>}
