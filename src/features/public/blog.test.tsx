import { afterEach, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { BlogPage } from './BlogPage'
import { blogPosts } from './blog-content'
afterEach(()=>{blogPosts.length=0})
it('renders the blog without invented articles',()=>{const html=renderToString(<StaticRouter location="/blog"><BlogPage/></StaticRouter>);expect(html).toContain('No articles published yet.');expect(html).toContain('application/ld+json')})
it('publishes an approved article as escaped readable content and structured data',()=>{blogPosts.push({slug:'clear-handover',title:'A clear handover',description:'Keep decisions together.',author:'Vimbre',published:'2026-10-29',sections:[{heading:'What to include',paragraphs:['A reason, an owner and a date.','<script>unsafe()</script>']}]});const html=renderToString(<StaticRouter location="/blog/clear-handover"><BlogPage slug="clear-handover"/></StaticRouter>);expect(html).toContain('A reason, an owner and a date.');expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');expect(html).toContain('BlogPosting');expect(html).toContain('https://vimbre.com/blog/clear-handover');expect(html).not.toContain('<script>unsafe()')})
it('offers a safe return for an unknown article',()=>{const html=renderToString(<StaticRouter location="/blog/missing"><BlogPage slug="missing"/></StaticRouter>);expect(html).toContain('Article not found');expect(html).toContain('href="/blog"');expect(html).not.toContain('BlogPosting')})
