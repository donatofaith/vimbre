import {useId,useState} from 'react'
import {Button} from '../../components/ui/Button'

/** Inline fields avoid an OS time dialog that can extend beyond a narrow screen. */
export function TimeField({value,onChange,disabled}:{value:string;onChange:(time:string)=>void;disabled?:boolean}){
 const id=useId()
 const [hours,setHours]=useState(value.split(':')[0]||'')
 const [minutes,setMinutes]=useState(value.split(':')[1]||'')
 function update(h:string,m:string){onChange(h||m?`${h.padStart(2,'0')}:${m.padStart(2,'0')}`:'')}
 return <fieldset className="md-task-time" disabled={disabled}><legend>Due time (optional)</legend><div className="md-task-time-fields">
  <label htmlFor={`${id}-hours`}>Hour<input id={`${id}-hours`} type="text" inputMode="numeric" autoComplete="off" maxLength={2} placeholder="00" pattern="([01]?[0-9]|2[0-3])" required={Boolean(minutes)} value={hours} onChange={e=>{setHours(e.target.value);update(e.target.value,minutes)}}/></label>
  <label htmlFor={`${id}-minutes`}>Minute<input id={`${id}-minutes`} type="text" inputMode="numeric" autoComplete="off" maxLength={2} placeholder="00" pattern="[0-5]?[0-9]" required={Boolean(hours)} value={minutes} onChange={e=>{setMinutes(e.target.value);update(hours,e.target.value)}}/></label>
  <Button variant="secondary" onClick={()=>{setHours('');setMinutes('');onChange('')}}>Clear time</Button>
 </div></fieldset>
}
