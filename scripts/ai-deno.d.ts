// Minimal host boundary for the gateway's local TypeScript check. Deployment also compiles with Deno.
declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):void}
