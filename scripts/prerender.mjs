import { createServer } from 'vite'
import { readFile, writeFile, readdir } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { renderLanding } = await server.ssrLoadModule('/src/features/public/prerender.tsx')
  let html = await readFile('dist/index.html', 'utf8')
  const rendered = renderLanding()
  if (!rendered.includes('Someone leaving or away?') || !rendered.includes('application/ld+json')) throw new Error('Landing prerender is incomplete')
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
  console.log('Homepage prerendered with full content, FAQs and matching JSON LD.')
} finally { await server.close() }

