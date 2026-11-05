import {AnimatedCTA} from './AnimatedCTA'
import {LandingTourLink} from './LandingTourLink'
import {useEffect,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {HeroHeadline} from './HeroHeadline'
import {PublicFrame} from './PublicFrame'
import {FAQ,IntegrationList,Pricing} from './PublicSections'
import {Walkthrough,WalkthroughImage} from './Walkthrough'
import {walkthrough} from './walkthrough.config'
import {heroDescription} from './public-content'
import {schema} from './landing-content'
import {ContactSection} from './ContactSection'
import {WebsiteSupport} from './WebsiteSupport'
import {trackMarketing,type AccountType} from './marketing-analytics'
export function LandingPage({authenticated=false,loading=false}:{authenticated?:boolean;loading?:boolean}){const [active,setActive]=useState(0),[paused,setPaused]=useState(true),[role,setRole]=useState<AccountType>('individual');const tourStarted=useRef(false)
 const lastStep=walkthrough.length-1
 useEffect(()=>{
   if(paused)return
   const media=window.matchMedia('(prefers-reduced-motion: reduce)')
   let timer:ReturnType<typeof setTimeout>|undefined
   function sync(){
     clearTimeout(timer)
     if(media.matches){setPaused(true);return}
     if(document.hidden)return
     timer=setTimeout(()=>{
       if(active<lastStep){setActive(active+1);return}
       setPaused(true)
       if(tourStarted.current){trackMarketing('tour_complete',{});tourStarted.current=false}
     },6000)
   }
   sync()
   media.addEventListener('change',sync)
   document.addEventListener('visibilitychange',sync)
   return()=>{clearTimeout(timer);media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync)}
 },[active,lastStep,paused])
 useEffect(()=>{
   function play(){
     tourStarted.current=true
     setActive(0)
     setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
     trackMarketing('tour_start',{})
     trackMarketing('hero_demo_run',{})
   }
   window.addEventListener('vimbre:tour-start',play)
   if(window.location.hash==='#product-demo')play()
   return()=>window.removeEventListener('vimbre:tour-start',play)
 },[])
 const signup='/signup?account_type='+role;return <PublicFrame authenticated={authenticated} loading={loading}><section className="rs-hero public-hero" aria-labelledby="hero-title"><div className="rs-container"><p className="rs-eyebrow">Work continuity for teams</p><HeroHeadline/><p className="rs-hero-subhead">{heroDescription}</p>{!authenticated&&<div className="public-role-picker" role="group" aria-label="How will you use Vimbre?">{([['individual','Individual'],['sole_founder','Sole founder'],['company','Company']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={role===value} onClick={()=>{setRole(value);trackMarketing('hero_role_selected',{account_type:value})}}>{label}</button>)}</div>}<div className="rs-actions">{!authenticated&&<div className="public-signup-cta"><Link className="rs-button" to={signup} onClick={()=>trackMarketing('cta_click',{location:'hero'})}>Get started →</Link><small>no card required</small></div>}<LandingTourLink/></div><div className="public-hero-card" data-hero-step={walkthrough[active].id}><div className="public-card-bar"><span>Demo workspace</span><span>{walkthrough[active].featureTag}</span></div><WalkthroughImage step={walkthrough[active]} priority/><div className="public-hero-caption"><strong>{walkthrough[active].title}</strong><p>{walkthrough[active].oneLine}</p><div className="public-card-dots" role="group" aria-label="Choose a preview">{walkthrough.map((s,i)=><button key={s.id} type="button" aria-label={s.title} aria-pressed={active===i} onClick={()=>{setActive(i);setPaused(true);trackMarketing('hero_demo_run',{})}}/>)}</div></div></div></div></section><section className="rs-section public-intro"><div className="rs-container"><h2>What is Vimbre?</h2><p>Vimbre keeps the context behind your work, so whoever picks it up next knows what was decided and why.</p><div className="public-link-grid">{[['Handovers','/use-cases/handover','Pick up the work with its priorities and next steps.'],['Decisions','/use-cases/decisions','Keep what was agreed and the reason behind it.'],['Workday planner','/use-cases/workday-planner','Choose what deserves attention today.']].map(([name,to,copy])=><Link to={to} key={to}><h3>{name}<svg className="public-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></h3><p>{copy}</p></Link>)}</div></div></section><section id="product-demo" tabIndex={-1} aria-labelledby="product-demo-title" className="rs-section public-product"><div className="rs-container"><h2 id="product-demo-title">What does Vimbre do?</h2><Walkthrough active={active} onChange={i=>{setActive(i);setPaused(true)}}/></div></section><section className="rs-section"><div className="rs-container"><h2>Who is Vimbre for?</h2><div className="public-link-grid">{[['Individuals','/for-individuals','Your own tasks, notes and decisions.'],['Sole founders','/for-founders','Client work and business commitments.'],['Companies','/for-companies','Team context, continuity and reviewed cover.']].map(([name,to,copy])=><Link to={to} key={to}><h3>{name}<svg className="public-card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></h3><p>{copy}</p></Link>)}</div></div></section><section className="rs-section public-integrations-section"><div className="rs-container"><h2>What does Vimbre work with?</h2><p>Choose the records to bring in. Connections depend on provider setup and company permission.</p><IntegrationList/></div></section><section id="pricing" className="rs-section rs-pricing-section"><div className="rs-container"><h2>How much does Vimbre cost?</h2><Pricing authenticated={authenticated} showNotes={false}/><Link to="/pricing">Compare plans →</Link></div></section><section id="questions" className="rs-section"><div className="rs-container rs-faq"><div><h2>What else would you like to know?</h2><Link to="/faq">All questions →</Link></div><FAQ/></div></section><AnimatedCTA/><CareersInvitation/><ContactSection/><WebsiteSupport/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/></PublicFrame>}

function CareersInvitation() {
  return (
    <section className="rs-section careers-invitation" aria-labelledby="careers-invitation-title">
      <div className="rs-container careers-invitation-inner">
        <div>
          <h2 id="careers-invitation-title">Would you like to join our team?</h2>
          <p>Tell us about yourself for future opportunities at Vimbre.</p>
        </div>
        <Link className="rs-button rs-button-outline" to="/careers">
          Explore careers <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
