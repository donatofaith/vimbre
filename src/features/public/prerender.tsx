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

import {PublicPage} from './PublicPage'
export {publicPages,metaFor,definition} from './public-content'
export function renderPublic(path:string){return renderToString(<StaticRouter location={path}><PublicPage path={path}/></StaticRouter>)}

import {AuthProvider} from '../auth/AuthProvider'
import {AuthPage} from '../auth/AuthPage'
export function renderAccount(path:string){const mode=path==='/signup'?'signup':path==='/forgot'?'forgot':path==='/reset-password'?'reset':'login';return renderToString(<StaticRouter location={path}><AuthProvider><AuthPage mode={mode}/></AuthProvider></StaticRouter>)}
