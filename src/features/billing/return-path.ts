export function billingReturnPath(search:string,fallback='/app'){
 const plan=new URLSearchParams(search).get('plan')
 return plan&&['starter','growth','business'].includes(plan)?'/app/billing?plan='+plan:fallback
}
