import { useId } from 'react'
type Option<T extends string> = {value:T;label:string}
export function SegmentedControl<T extends string>({label,value,options,onChange}:{label:string;value:T;options:readonly Option<T>[];onChange:(value:T)=>void}) {
 const id=useId()
 return <div className="segmented-control" role="group" aria-label={label}>{options.map(option=><button key={option.value} type="button" aria-pressed={value===option.value} onClick={()=>onChange(option.value)} id={`${id}-${option.value}`}>{option.label}</button>)}</div>
}
