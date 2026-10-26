import {readFile,readdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const html=await readFile('dist/index.html','utf8')
const version=createHash('sha256').update(html).digest('hex').slice(0,16)
const assets=(await readdir('dist/assets')).filter(name=>/\.(js|mjs|css|woff2)$/.test(name)).map(name=>'/assets/'+name)
assets.push('/favicon-192.png','/vimbre-icon-512.png')
const original=await readFile('dist/sw.js','utf8')
await writeFile('dist/sw.js','self.VIMBRE_OFFLINE_ASSETS='+JSON.stringify(assets)+';\n'+original.replace("const CACHE='vimbre-shell-v2';",`const CACHE='vimbre-shell-${version}';`))
console.log(`Prepared ${assets.length} static resources for offline installation.`)
