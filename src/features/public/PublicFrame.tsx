import type {ReactNode} from 'react'
import {Link} from 'react-router-dom'
import {BrandLogo} from '../../components/ui/BrandLogo'
import {LandingHeader} from './LandingHeader'
import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import './landing.css'
import './public-pages.css'
export function PublicFrame({children,authenticated=false,loading=false}:{children:ReactNode;authenticated?:boolean;loading?:boolean}){return <div className="rs-site" data-theme="light"><a className="skip-link" href="#rs-main">Skip to content</a><LandingHeader authenticated={authenticated} loading={loading}/><main id="rs-main">{children}</main><footer className="rs-footer"><div className="rs-container"><div className="rs-footer-top"><Link className="rs-footer-brand" to="/" aria-label="Vimbre home"><BrandLogo/></Link><nav aria-label="Footer">{[['Product','/how-it-works'],['Pricing','/pricing'],['FAQ','/faq'],['Integrations','/integrations'],['Individuals','/for-individuals'],['Founders','/for-founders'],['Companies','/for-companies'],['Blog','/blog'],['Careers','/careers'],['Contact','/#contact'],['Privacy','/privacy'],['Terms','/terms']].map(([name,to])=><Link key={to} to={to}>{name}</Link>)}<CookieSettingsLink/></nav></div><p>© 2026 Genade Global Service Limited.</p></div></footer></div>}
