import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {StaticRouter} from 'react-router-dom'
import {LandingPage} from '../src/features/public/LandingPage'
it('offers consistent workspace actions in the header and beside the hero walkthrough',()=>{
 const html=renderToStaticMarkup(<StaticRouter location="/"><LandingPage authenticated/></StaticRouter>)
 expect(html.match(/>Go to workspace</g)).toHaveLength(2)
 expect(html).not.toContain('Open workspace')
 const hero=html.slice(html.indexOf('aria-labelledby="hero-title"'),html.indexOf('id="product-demo"'))
 expect(hero).toContain('See the walkthrough')
 expect(hero).toContain('href="/app"')
})
it('keeps signup and login reachable for visitors',()=>{
 const html=renderToStaticMarkup(<StaticRouter location="/"><LandingPage/></StaticRouter>)
 expect(html).toContain('rs-header-cta" href="/signup"')
 expect(html).toContain('rs-mobile-login" href="/login"')
 expect(html).not.toContain('Go to workspace')
})
