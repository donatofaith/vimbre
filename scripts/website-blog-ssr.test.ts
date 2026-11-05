import {it,expect}from 'vitest'
// @ts-expect-error The public HTML renderer is also used by the Node function.
import {blogContent}from '../server/website-blog.mjs'
const post={slug:'test-post',title:'A <script>title</script>',description:'Test description',author:'Vimbre',published:'2026-11-04',sections:[{heading:'Heading',paragraphs:['Safe <img src=x onerror=alert(1)> text']}],template:'<script>alert(1)</script>'}
it('escapes article, template and list content',()=>{const html=blogContent([post],'test-post');expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=x');expect(html).toContain('&lt;script&gt;');expect(blogContent([post],'')).toContain('/blog/test-post')})
it('unknown or unpublished article addresses never render another article',()=>{const html=blogContent([post],'hidden-post');expect(html).toContain('Article not found');expect(html).not.toContain(post.description)})
