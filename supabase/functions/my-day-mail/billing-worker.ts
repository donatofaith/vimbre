type Job={id:string;email:string;name:string;kind:'started'|'ending';plan:string;amount:number;trial_ends_at:string}
type Deps={rpc:(operation:string,id?:string,state?:string)=>Promise<unknown>;send:(job:Job&{title:string;body:string})=>Promise<Response>}
export function trialMail(job:Job){
 const end=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}).format(new Date(job.trial_ends_at))
 return {title:job.kind==='ending'?'Your Vimbre trial ends tomorrow':'Your 3-day Vimbre trial has started',body:`Your ${job.plan} trial ${job.kind==='ending'?'ends':'will end'} on ${end}.\n\nYour saved card will be charged £${job.amount.toFixed(2)} per month starting then, unless you cancel before the trial ends. Any applicable tax is shown in your billing details.\n\nManage your subscription or cancel: https://vimbre.com/app/billing\n\nIf payment fails, we will ask you to update your card. Your saved records and manual work remain available.\n\nQuestions? support@vimbre.com`}
}
export async function deliverBillingTrials(d:Deps){
 const jobs=await d.rpc('claim') as Job[]
 if(!Array.isArray(jobs))throw Error('Billing reminder queue unavailable')
 for(const job of jobs){let state='uncertain';try{const response=await d.send({...job,...trialMail(job)});state=response.ok?'sent':response.status===429||response.status>=500?'failed':'rejected'}catch{/* Do not retry an ambiguous provider acceptance. */}await d.rpc('finish',job.id,state)}
}
