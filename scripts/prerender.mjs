import { createServer } from 'vite'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { renderLanding, renderBlog, blogPosts } = await server.ssrLoadModule('/src/features/public/prerender.tsx')
  let html = await readFile('dist/index.html', 'utf8')
  const rendered = renderLanding()
  if (!rendered.includes('Understand the') || !rendered.includes('application/ld+json')) throw new Error('Landing prerender is incomplete')
  html = html.replace('<div id="root"></div>', '<div id="root">' + rendered + '</div>')
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
  const css = new Set()
  const visited = new Set()
  const visit = (key) => {
    if (visited.has(key)) return
    visited.add(key)
    const item = manifest[key]
    if (!item) return
    for (const file of item.css ?? []) css.add(file)
    for (const dependency of item.imports ?? []) visit(dependency)
  }
  for (const key of Object.keys(manifest)) if (key.includes('HomePage') || key.includes('LandingPage')) visit(key)
  const fonts = await readdir('dist/assets')
  const heading = fonts.find(name => /^plus-jakarta-sans-latin-wght-normal-.*\.woff2$/.test(name))
  const links = [...css].map(file => '<link rel="stylesheet" href="/' + file + '">')
  if (heading) links.push('<link rel="preload" as="font" type="font/woff2" href="/assets/' + heading + '" crossorigin>')
  html = html.replace('</head>', links.join('\n') + '\n</head>')
  if ((rendered.match(/<h1(?:\s|>)/g) ?? []).length !== 1) throw new Error('Homepage must have exactly one H1')
  await writeFile('dist/index.html', html)
  const escape = value => value.replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))
  const slugs = new Set()
  for (const post of blogPosts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug) || slugs.has(post.slug) || !/^\d{4}-\d{2}-\d{2}$/.test(post.published) || !post.title || !post.description || !post.author || !post.sections.length) throw new Error('Invalid or duplicate published blog article')
    slugs.add(post.slug)
  }
  const template = await readFile('dist/index.html','utf8')
  for (const post of [null,...blogPosts]) {
    const path = '/blog'+(post?'/'+post.slug:'')
    const canonical = 'https://vimbre.com'+path
    const title = post?post.title+' | Vimbre':'Blog | Vimbre'
    const description = post?.description ?? 'Articles on decisions, work context and handovers from Vimbre.'
    let page = template.replace('<div id="root">'+rendered+'</div>','<div id="root">'+renderBlog(post?.slug)+'</div>')
    page=page.replace(/<title>.*?<\/title>/, ()=>'<title>'+escape(title)+'</title>').replace(/<link rel="canonical"[^>]*>/,'<link rel="canonical" href="'+canonical+'" />')
    page=page.replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*/g, (_,prefix)=>prefix+escape(description)).replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*/g,(_,prefix)=>prefix+escape(title)).replace(/(<meta property="og:url" content=")[^"]*/,'$1'+canonical).replace(/(<meta property="og:type" content=")[^"]*/,'$1'+(post?'article':'website'))
    await mkdir('dist'+path,{recursive:true});await writeFile('dist'+path+'/index.html',page)
  }
  const urls=['/','/blog',...blogPosts.map(post=>'/blog/'+post.slug)]
  await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(path=>'<url><loc>https://vimbre.com'+path+'</loc></url>').join('')+'</urlset>')
  await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nSitemap: https://vimbre.com/sitemap.xml\n')
  console.log('Homepage prerendered with full content, FAQs and matching JSON LD.')
} finally { await server.close() }

