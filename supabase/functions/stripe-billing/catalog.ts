export const STRIPE_ACCOUNT='acct_1UUoHn3dlOUNkjoi'
export const PORTAL_CONFIGURATION='bpc_1UVTj53dlOUNkjoipMa71ah4'
export const TRIAL_DAYS=3
export const plans={
 starter:{name:'Starter',price:'price_1UVThi3dlOUNkjoi0ggow2Zu',amount:2900,seats:10},
 growth:{name:'Growth',price:'price_1UVThn3dlOUNkjoiywZd15dC',amount:9900,seats:50},
 business:{name:'Business',price:'price_1UVThs3dlOUNkjoieDyhZHQw',amount:24900,seats:250},
} as const
export type Plan=keyof typeof plans
export function planForPrice(price:string){return(Object.keys(plans) as Plan[]).find(key=>plans[key].price===price)}
// A company has one trial deadline. Retrying Checkout never grants three fresh days.
export function remainingTrial(trialEndsAt:string,now=Date.now()){
 const end=Math.floor(Date.parse(trialEndsAt)/1000)
 return Number.isFinite(end)&&end>Math.floor(now/1000)+48*3600?end:undefined
}
export function subscriptionAccess(status:string,trialEnd:number|null,periodEnd:number|null,now=Date.now()/1000){
 if(status==='trialing')return trialEnd!==null&&trialEnd>now
 return status==='active'&&periodEnd!==null&&periodEnd>now
}
