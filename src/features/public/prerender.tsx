import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'
export function renderLanding() { return renderToString(<StaticRouter location="/"><LandingPage /></StaticRouter>) }

import { BlogPage } from './BlogPage'
import { blogPosts } from './blog-content'
export { blogPosts }
export function renderBlog(slug?:string) { return renderToString(<StaticRouter location={'/blog'+(slug?'/'+slug:'')}><BlogPage slug={slug}/></StaticRouter>) }

import {LegalDocumentPage} from './LegalPage'
export function renderLegal(page:'privacy'|'terms'|'competition') {return renderToString(<StaticRouter location={page==='competition'?'/competition-terms':'/'+page}><LegalDocumentPage page={page}/></StaticRouter>)}
