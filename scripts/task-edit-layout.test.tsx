import {it,expect,vi} from 'vitest'
import {renderToString} from 'react-dom/server'
import {StaticRouter} from 'react-router-dom'
import {TaskPanel} from '../src/features/my-day/TaskPanel'
import {TaskCard} from '../src/features/my-day/TaskCard'
import type {Task} from '../src/features/my-day/types'
vi.mock('../src/features/auth/AuthProvider',()=>({useAuth:()=>({profile:{id:'owner',full_name:'Example Owner'}})}))
const task={id:'test',title:'Review report',status:'open',priority:'normal',details:'Review the report.',due_date:'2026-10-30',due_at:'2026-10-30T09:00:00Z',remind_at:'2026-10-30T09:00:00Z',completion_note:'',source_kind:'manual',reminder_option:'at_time',deleted_at:null} as Task
it('places Delete only in the existing-task edit footer beside Save, not on add forms',()=>{const render=(existing?:Task)=>renderToString(<StaticRouter location="/app"><TaskPanel task={existing} today="2026-10-30" saved={()=>{}} close={()=>{}} remove={async()=>true}/></StaticRouter>);const edit=render(task),add=render();expect(edit).toMatch(/md-panel-actions[\s\S]*>Delete<\/button>[\s\S]*>Save changes<\/button>/);expect(add).not.toContain('>Delete</button>');expect(add).toContain('Save task')})
it('keeps the task viewer free of a second Delete control',()=>{const html=renderToString(<StaticRouter location="/app"><TaskCard task={task} zone="UTC" busy={false} now={new Date('2026-10-30T10:00:00Z')} initialOpen act={()=>{}} edit={()=>{}} remind={()=>{}} context={()=>{}} quickContext={()=>{}} record={()=>{}} drag={()=>{}}/></StaticRouter>);expect(html).toContain('Edit task');expect(html).not.toContain('>Delete</button>')})
