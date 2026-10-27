import {useState} from 'react'
import {Button} from './Button'
import {Card} from './Card'
import {Input} from './Input'
import {SegmentedControl} from './SegmentedControl'
export function UIPreview(){
 const [view,setView]=useState('list')
 return <section className="ui-preview"><h1 tabIndex={-1}>UI components</h1><p>Shared controls and their states.</p><Card><h2>Buttons</h2><div className="form-actions"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button disabled>Disabled</Button><Button loading>Loading</Button></div></Card><Card><h2>Fields</h2><Input label="Task title" placeholder="Send the supplier update"/><Input label="Unavailable field" disabled value="Read only" readOnly/><Input label="Required field" error="Enter a title."/></Card><Card><h2>View choices</h2><SegmentedControl label="Example view" value={view} onChange={setView} options={[{value:'list',label:'List'},{value:'board',label:'Board'},{value:'week',label:'Week'}]}/></Card><Card><h2>Menu</h2><details data-menu><summary>Task actions</summary><div className="form-actions"><Button variant="secondary" onClick={e=>{e.currentTarget.closest('details')!.open=false}}>Close menu</Button></div></details></Card><Card><h2>Feedback</h2><p role="status">Saved</p><p className="field-error">The task could not be saved. Try again.</p><p>No tasks due today.</p></Card></section>
}
