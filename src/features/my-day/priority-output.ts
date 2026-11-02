import {parsePlan} from './plan-output'
export function parsePriorities(output:string,allowed:ReadonlySet<string>){
 const items=parsePlan(output,allowed)
 if(items.length>3||items.some(item=>!item.reason.trim()))throw Error('The priority suggestions could not be read. Try again.')
 return items
}
