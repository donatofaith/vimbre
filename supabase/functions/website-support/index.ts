import {handle} from './handler.ts'
Deno.serve(r=>handle(r,n=>Deno.env.get(n)))
