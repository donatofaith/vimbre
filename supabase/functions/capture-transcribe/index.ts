import { transcribeRequest } from './handler.ts'

Deno.serve(req => transcribeRequest(req, name => Deno.env.get(name)))
