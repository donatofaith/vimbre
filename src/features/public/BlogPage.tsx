import {CookieSettingsLink} from '../analytics/AnalyticsConsent'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { LandingHeader } from './LandingHeader'
import { blogPosts } from './blog-content'
import './landing.css'
export function BlogRoute() {
  const { slug } = useParams()
  const { session, loading } = useAuth()
  return <BlogPage slug={slug} authenticated={Boolean(session)} loading={loading}/>
}
export function BlogPage({slug,authenticated=false,loading=false}:{slug?:string;authenticated?:boolean;loading?:boolean}) {
  const post = blogPosts.find(p=>p.slug===slug)
  const missing = Boolean(slug && !post)
  const title = missing ? 'Article not found | Vimbre' : post ? post.title+' | Vimbre' : 'Blog | Vimbre'
  const description = post?.description ?? 'Articles on decisions, work context and handovers from Vimbre.'
  const canonical = 'https://vimbre.com/blog'+(post?'/'+post.slug:'')
  useEffect(()=>{
    if(!window.location.hash)window.scrollTo({top:0,left:0,behavior:'instant'})
  },[slug])
  useEffect(()=>{
    document.title=title
    const changes:{element:Element;attribute:string;old:string|null;created:boolean}[]=[]
    function set(selector:string,tag:string,key:string,value:string,attribute:string){let element=document.head.querySelector(selector);const created=!element;if(!element){element=document.createElement(tag);element.setAttribute(key,value);document.head.append(element)}changes.push({element,attribute,old:element.getAttribute(attribute),created});element.setAttribute(attribute,attribute==='href'?canonical:selector.includes('description')?description:selector.includes('robots')?(missing?'noindex':'index,follow'):selector.includes('url')?canonical:selector.includes('type')?(post?'article':'website'):title)}
    set('link[rel="canonical"]','link','rel','canonical','href')
    set('meta[name="description"]','meta','name','description','content')
    set('meta[name="robots"]','meta','name','robots','content')
    for(const key of ['title','description','url','type'])set(`meta[property="og:${key}"]`,'meta','property',`og:${key}`,'content')
    for(const key of ['title','description'])set(`meta[name="twitter:${key}"]`,'meta','name',`twitter:${key}`,'content')
    return()=>{for(const c of changes){if(c.created)c.element.remove();else if(c.old===null)c.element.removeAttribute(c.attribute);else c.element.setAttribute(c.attribute,c.old)}}
  },[title,description,canonical,missing,post])
  const schema=post?{'@context':'https://schema.org','@graph':[
    {'@type':['Article','BlogPosting'],headline:post.title,description:post.description,datePublished:post.published,dateModified:post.published,author:{'@type':'Organization',name:post.author,url:'https://vimbre.com/'},mainEntityOfPage:canonical,url:canonical,image:'https://vimbre.com/vimbre-work-context-og-1200.png',publisher:{'@type':'Organization',name:'Vimbre',url:'https://vimbre.com/',logo:{'@type':'ImageObject',url:'https://vimbre.com/favicon-192.png'}}},
    ...(post.faq?.length?[{'@type':'FAQPage',mainEntity:post.faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))}]:[])
  ]}:{'@context':'https://schema.org','@type':'Blog',name:'Vimbre Blog',url:canonical}

  return <div className="rs-site" data-theme="light"><LandingHeader authenticated={authenticated} loading={loading}/><main className="rs-section"><div className="rs-container rf-blog">
    {missing?<><h1 tabIndex={-1}>Article not found</h1><Link to="/blog">Back to Blog</Link></>:post?<article><Link className="rs-text-link" to="/blog">← Blog</Link><h1 tabIndex={-1}>{post.title}</h1><p className="rf-blog-meta">{post.author} · <time dateTime={post.published}>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(post.published+'T12:00:00Z'))}</time></p><p className="rf-blog-description">{post.description}</p>{post.sections.map(section=><section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</section>)}{post.template&&<section className="guide-template"><h2>Free, reusable template</h2><p>Download the plain text template to edit in your preferred document tool, or select the text below. Replace the bracketed prompts with your own details.</p><a className="rs-button" href={'/templates/'+post.slug+'.txt'} download>Download template (.txt)</a><pre>{post.template}</pre></section>}{post.faq?.length&&<section><h2>Frequently asked questions</h2>{post.faq.map(item=><div key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></div>)}</section>}<aside className="guide-related"><h2>Related handover guides</h2><ul>{blogPosts.filter(item=>item.slug!==post.slug).map(item=><li key={item.slug}><Link to={'/blog/'+item.slug}>{item.title}</Link></li>)}</ul></aside></article>:<><h1 tabIndex={-1}>Blog</h1><p className="rf-blog-description">Decisions, work context and handovers.</p>{blogPosts.length?<div className="rf-blog-list">{[...blogPosts].sort((a,b)=>b.published.localeCompare(a.published)).map(p=><article key={p.slug}><time dateTime={p.published}>{p.published}</time><h2><Link to={'/blog/'+p.slug}>{p.title}</Link></h2><p>{p.description}</p><Link className="rs-text-link" to={'/blog/'+p.slug}>Read article →</Link></article>)}</div>:<p className="rf-blog-empty">No articles published yet.</p>}</>}
    {!missing&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>}
  </div></main><footer className="rs-footer"><div className="rs-container"><Link to="/">Back to website</Link> · <Link to="/privacy">Privacy policy</Link> · <Link to="/terms">Terms and conditions</Link> · <CookieSettingsLink /></div></footer></div>
}
