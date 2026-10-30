import { afterEach, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { BlogPage } from './BlogPage'
import { blogPosts } from './blog-content'
const approved=[...blogPosts]
afterEach(()=>{blogPosts.splice(0,blogPosts.length,...approved)})
it('renders the six approved guides without top-level navigation entries',()=>{const html=renderToString(<StaticRouter location="/blog"><BlogPage/></StaticRouter>);expect(blogPosts).toHaveLength(6);expect(html).toContain('Employee handover template');expect(html).toContain('application/ld+json')})
it('publishes an approved article as escaped readable content and structured data',()=>{blogPosts.push({slug:'clear-handover',title:'A clear handover',description:'Keep decisions together.',author:'Vimbre',published:'2026-10-29',sections:[{heading:'What to include',paragraphs:['A reason, an owner and a date.','<script>unsafe()</script>']}]});const html=renderToString(<StaticRouter location="/blog/clear-handover"><BlogPage slug="clear-handover"/></StaticRouter>);expect(html).toContain('A reason, an owner and a date.');expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');expect(html).toContain('BlogPosting');expect(html).toContain('https://vimbre.com/blog/clear-handover');expect(html).not.toContain('<script>unsafe()')})
it('offers a safe return for an unknown article',()=>{const html=renderToString(<StaticRouter location="/blog/missing"><BlogPage slug="missing"/></StaticRouter>);expect(html).toContain('Article not found');expect(html).toContain('href="/blog"');expect(html).not.toContain('BlogPosting')})

it('provides a usable downloadable template and matching FAQ/Article data on every guide',()=>{for(const post of approved){const html=renderToString(<StaticRouter location={'/blog/'+post.slug}><BlogPage slug={post.slug}/></StaticRouter>);expect(post.template!.length).toBeGreaterThan(700);expect(html).toContain('download=""');expect(html).toContain('/templates/'+post.slug+'.txt');expect(html).toContain('FAQPage');expect(html).toContain('Article');expect(html).toContain('Related handover guides');expect(html).not.toContain('No articles published yet.')}})
