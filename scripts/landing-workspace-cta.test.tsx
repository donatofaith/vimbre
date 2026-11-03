import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {StaticRouter} from 'react-router-dom'
import {LandingPage} from '../src/features/public/LandingPage'
it('links authenticated visitors to the current workspace',()=>{const html=renderToStaticMarkup(<StaticRouter location="/"><LandingPage authenticated/></StaticRouter>);expect(html.match(/Go to workspace/g)).toHaveLength(2);expect(html).toContain('href="/app"');expect(html).toContain('Take the product tour')})
it('has exactly one login and one get-started link in the header',()=>{const html=renderToStaticMarkup(<StaticRouter location="/"><LandingPage/></StaticRouter>);const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'));expect(header.match(/>Log in</g)).toHaveLength(1);expect(header.match(/>Get started</g)).toHaveLength(1);expect(header).not.toContain('rs-mobile-login')})
