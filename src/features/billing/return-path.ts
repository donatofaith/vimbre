const allowed=['starter','growth','business']
export function billingReturnPath(search:string,fallback='/app'){
 const params=new URLSearchParams(search),plan=params.get('plan')
 return plan&&allowed.includes(plan)?'/app/billing?plan='+plan:params.get('flow')==='signup'?'/app/billing':fallback
}
export function billingSignupCallback(origin:string,search:string){
 const url=new URL('/auth/callback',origin),plan=new URLSearchParams(search).get('plan');url.searchParams.set('flow','signup')
 if(plan&&allowed.includes(plan))url.searchParams.set('plan',plan)
 return url.href
}
