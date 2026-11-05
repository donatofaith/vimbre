import {handler}from './handler.ts'
declare const EdgeRuntime:{waitUntil(work:Promise<unknown>):void}
Deno.serve(req=>handler(req,name=>Deno.env.get(name),fetch,work=>EdgeRuntime.waitUntil(work)))
