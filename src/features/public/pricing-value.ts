/** A comparison of visitor estimates, never a claim about realised savings. */
export function handoverTimeCost(handovers:string,hours:string,hourlyCost:string):number|null{
 const values=[handovers,hours,hourlyCost]
 if(values.some(v=>!v.trim()||!Number.isFinite(Number(v))||Number(v)<0))return null
 const total=values.reduce((product,value)=>product*Number(value),1)
 return Number.isFinite(total)?total:null
}
