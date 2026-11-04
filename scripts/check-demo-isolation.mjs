import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const html=await readFile('dist/demo/index.html','utf8')
assert(html.includes("connect-src 'none'"),'Public demo must block backend connections')
const entry=html.match(/src="([^" ]+\.js)"/)[1]
const js=await readFile('dist'+entry,'utf8')
assert(js.includes('https://demo.invalid'),'Demo must use its isolated client')
assert(!js.includes('ijyjrooarwoafkykvzjp.supabase.co'),'Real Supabase client leaked into demo')
assert(!js.includes('sb-ijyjrooarwoafkykvzjp-auth-token'),'Demo must not share account authentication')
console.log('Public demo client and network isolation passed')
