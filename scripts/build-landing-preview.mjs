// A landing-only review build from the actual React page. No Auth requests or customer data.
import { build } from 'vite'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const root = process.cwd()
const temporary = resolve(root, 'node_modules/.tmp/landing-review')
const output = resolve(root, process.env.VIMBRE_REVIEW_OUTPUT || 'landing-review')
await build({ build: { ssr: 'scripts/landing-preview-entry.tsx', outDir: temporary, emptyOutDir: true } })
const { renderLanding } = await import(pathToFileURL(resolve(temporary, 'landing-preview-entry.js')))
const css = (await Promise.all(['tokens.css', 'global.css'].map(name => readFile(resolve(root, 'src/styles', name), 'utf8')))).join('\n') + '\n' + await readFile(resolve(root, 'src/features/public/landing.css'), 'utf8')
let fontCss = ''
for (const [name, family] of [['geist', 'Geist Variable'], ['plus-jakarta-sans', 'Plus Jakarta Sans Variable']]) {
  const bytes = await readFile(resolve(root, `node_modules/@fontsource-variable/${name}/files/${name}-latin-wght-normal.woff2`))
  fontCss += `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2')}\n`
}
const html = renderLanding().replace(/href="\/(signup|login)"/g, 'href="https://vimbre.vercel.app/$1"')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Vimbre · Landing page review</title><style>${fontCss}${css}\n.review-notice{padding:10px 20px;background:#102a43;color:#fff;text-align:center;font:12px/1.5 sans-serif}.review-notice a{color:#d9edaa}</style></head><body><aside class="review-notice">Design review · The live website is unchanged. Account links open the current live site.</aside>${html}<script>
const page=document.querySelector('.landing-page');const toggle=document.querySelector('.theme-toggle');
try{page.dataset.theme=localStorage.getItem('vimbre-public-theme')==='dark'?'dark':'light'}catch{}
function themeLabel(){const dark=page.dataset.theme==='dark';toggle.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');toggle.firstElementChild.textContent=dark?'☀':'☾'}themeLabel();
toggle.addEventListener('click',()=>{page.dataset.theme=page.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('vimbre-public-theme',page.dataset.theme)}catch{}themeLabel()});
const menu=document.querySelector('.public-menu');const nav=document.querySelector('.public-nav');function closeMenu(){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open website menu');menu.textContent='Menu'}
menu.addEventListener('click',()=>{if(nav.classList.contains('is-open'))return closeMenu();nav.classList.add('is-open');menu.setAttribute('aria-expanded','true');menu.setAttribute('aria-label','Close website menu');menu.textContent='Close'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('is-open')){closeMenu();menu.focus()}});
</script></body></html>`)
await rm(temporary, { recursive: true, force: true })
console.log(`Landing review built: ${output}`)
