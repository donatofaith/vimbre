// Reuse the authenticated scheduler and Brevo sender; never call AI for review nudges.
type Job={id:string;email:string;name:string;title:string;body:string}
type Deps={rpc:(operation:string,id?:string,state?:string)=>Promise<unknown>;send:(job:Job)=>Promise<Response>}
export async function deliverRoleReviews(d:Deps){const jobs=await d.rpc('claim') as Job[];if(!Array.isArray(jobs))throw Error('Role reminders unavailable');await Promise.all(jobs.map(async job=>{let state='failed';try{const response=await d.send(job);state=response.ok?'sent':'failed'}catch{/* Ambiguous sends are not retried automatically. */}await d.rpc('finish',job.id,state)}))}
