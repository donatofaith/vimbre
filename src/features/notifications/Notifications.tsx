import {useNotificationReceipts} from './useNotificationReceipts'
import {useRoleNotices} from '../records/useRoleNotices'
import {useSuiteNotifications} from '../my-day/useSuiteNotifications'
import {useServiceNotifications} from './useServiceNotifications'
import {useHandoverNotifications} from '../handovers/useHandoverNotifications'
import {useCaptureNotifications} from '../capture/useCaptureNotifications'
import { TaskAlerts } from '../my-day/TaskAlerts'
import { useTaskAlerts } from '../my-day/useTaskAlerts'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { WorkspaceIcon } from '../../components/ui/WorkspaceIcon'
import { useChat } from '../chat/chat-context'
import { chatTime } from '../chat/chat-types'
import { useWorkNotifications } from './useWorkNotifications'
import { reminderDate, reminderLabel, reminderPath } from './notification-utils'
export function Notifications() {
 const {inbox,error:chatError,refresh:refreshChat}=useChat()
 const [page,setPage]=useState(0)
 const receipts=useNotificationReceipts()
 const roleNotices=useRoleNotices()
 const suite=useSuiteNotifications()
 const service=useServiceNotifications()
 const handovers=useHandoverNotifications()
 const captures=useCaptureNotifications()
 const tasks=useTaskAlerts()
 const work=useWorkNotifications(page)
 const dialog=useRef<HTMLDialogElement>(null)
 const taskRows=tasks.rows.filter(t=>!suite.rows.some(s=>s.task_id===t.task_id&&Date.parse(s.created_at)>=Date.parse(t.created_at)))
 const suiteRows=suite.rows.filter(s=>!tasks.rows.some(t=>t.task_id===s.task_id&&Date.parse(t.created_at)>Date.parse(s.created_at)))
 const hiddenTaskNotices=suite.rows.length-suiteRows.length
 const unread=roleNotices.rows.filter(n=>!receipts.has('role',n.id)).length+Math.max(0,suite.unread-hiddenTaskNotices)+service.unread+inbox.unread+work.data.unread+taskRows.filter(n=>!receipts.has('task',n.id)).length+Math.max(0,captures.count-captures.rows.filter(n=>receipts.has('capture',n.id)).length)+Math.max(0,handovers.count-handovers.rows.filter(n=>receipts.has('handover',n.id)).length)
 return <><button className="chat-bell" type="button" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} onClick={()=>{void receipts.refresh();roleNotices.refresh();suite.refresh();service.refresh();work.refresh();refreshChat();tasks.refresh();captures.refresh();handovers.refresh();dialog.current?.showModal()}}><WorkspaceIcon name="bell"/>{unread>0&&<span className="chat-count">{unread>99?'99+':unread}</span>}</button>
 <dialog ref={dialog} className="vw-dialog chat-notifications" aria-labelledby="workspace-notifications-title"><div className="chat-dialog-heading"><h2 id="workspace-notifications-title">Notifications</h2><button className="button button-secondary" onClick={()=>dialog.current?.close()}>Close</button></div>
 {receipts.error&&<p role="alert">Read status could not be saved. <button onClick={()=>void receipts.refresh()}>Retry</button></p>}
 {work.error&&<p role="alert" className="field-error">Deadline reminders could not be loaded. <button type="button" onClick={work.refresh}>Retry</button></p>}
 {work.readError&&<p role="alert" className="field-error">The notification could not be marked as read. Please retry.</p>}
 {chatError&&<p role="alert" className="field-error">Message notifications could not be refreshed. <button type="button" onClick={refreshChat}>Retry</button></p>}
 {work.loading&&<p role="status">Loading reminders…</p>}
 {!work.error&&!chatError&&!work.loading&&suiteRows.length===0&&service.rows.length===0&&work.data.count===0&&inbox.items.length===0&&taskRows.length===0&&captures.count===0&&handovers.count===0&&roleNotices.rows.length===0&&<p>No unread notifications.</p>}
 {roleNotices.error&&<p role="alert">Role reminders could not be loaded. <button onClick={roleNotices.refresh}>Retry role reminders</button></p>}
 {roleNotices.rows.length>0&&<section><h3>My role</h3><ul>{roleNotices.rows.map(n=><li key={n.id}><Link to={`/app/role-record?role=${n.role_id}`} onClick={()=>{void receipts.read('role',n.id);dialog.current?.close()}}>{n.title}</Link></li>)}</ul></section>}
 {suite.error&&<p role="alert">Task updates could not be refreshed. <button onClick={suite.refresh}>Retry task updates</button></p>}
 {suiteRows.length>0&&<section><h3>Task updates</h3><ul>{suiteRows.map(n=><li key={n.id}><Link to={n.title==='Your day in review'&&/^\d{4}-\d{2}-\d{2} · /.test(n.body)?`/app?review_day=${n.body.slice(0,10)}`:n.task_id?`/app?comment_task=${n.task_id}`:'/app'} onClick={()=>{void suite.read(n.id);dialog.current?.close()}}><strong>{n.title}</strong><span>{n.body}</span>{n.task_status&&<small>{n.task_status==='done'?'Done':n.task_status==='in_progress'?'In progress':'To do'}</small>}</Link></li>)}</ul></section>}
 {service.error&&<p role="alert">Support and announcements could not be refreshed. <button onClick={service.refresh}>Retry</button></p>}
 {service.rows.length>0&&<section><h3>Updates</h3><ul>{service.rows.map(n=><li key={n.id} data-unread={!n.read_at}><Link to={n.link} onClick={()=>{void service.read(n.id);dialog.current?.close()}}><strong>{n.title}</strong><span>{n.body}</span></Link></li>)}</ul></section>}
 {tasks.error&&<p role="alert" className="field-error">Task reminders could not be loaded. <button onClick={tasks.refresh}>Retry task reminders</button></p>}
 {captures.error&&<p className="field-error" role="alert">Capture notifications could not be loaded. <button onClick={captures.refresh}>Retry capture notifications</button></p>}
 {captures.rows.length>0&&<section aria-labelledby="capture-alerts-title"><h3 id="capture-alerts-title">Captures</h3><ul>{captures.rows.map(n=><li key={n.id}><Link to={`/app/capture?capture=${n.id}`} onClick={()=>{void receipts.read('capture',n.id);dialog.current?.close()}}><strong>New capture received.</strong><span>{n.title}</span></Link></li>)}</ul></section>}
 {handovers.error&&<p role="alert">Handover notifications could not be loaded. <button onClick={handovers.refresh}>Retry handover notifications</button></p>}
 {handovers.rows.length>0&&<section><h3>Handovers</h3><ul>{handovers.rows.map(n=><li key={n.id}><Link to={`/app/handovers?handover=${n.handover_id}`} onClick={()=>{void receipts.read('handover',n.id);dialog.current?.close()}}>{n.message}</Link></li>)}</ul></section>}
 {taskRows.length>0&&<TaskAlerts alerts={taskRows} zone={tasks.zone} changed={tasks.refresh} read={id=>void receipts.read('task',id)} close={()=>dialog.current?.close()}/>}
 {work.data.count>0&&<section aria-labelledby="deadline-alerts-title"><h3 id="deadline-alerts-title">Deadlines</h3><ul>{work.data.items.map(n=><li key={n.notification_key} className="work-notification" data-unread={!n.read_at}><Link to={reminderPath(n)} onClick={()=>{void work.markRead(n.notification_key);dialog.current?.close()}}><span className={`deadline-stage deadline-stage-${n.stage}`}>{reminderLabel(n)}</span><strong>{n.title}</strong><span>{n.source_kind==='task'?'Task':n.section==='responsibility'?'Responsibility':'Recurring deadline'} · {reminderDate(n.due_date)}</span></Link>{!n.read_at&&<button type="button" className="work-mark-read" disabled={Boolean(work.busy)} onClick={()=>{void work.markRead(n.notification_key)}} aria-label={`Mark ${n.title} as read`}>{work.busy===n.notification_key?'Saving…':'Mark as read'}</button>}</li>)}</ul><div className="notification-pages">{page>0&&<button className="button button-secondary" onClick={()=>setPage(p=>p-1)}>Previous reminders</button>}{(page+1)*50<work.data.count&&<button className="button button-secondary" onClick={()=>setPage(p=>p+1)}>More reminders</button>}</div></section>}
 {inbox.items.length>0&&<section aria-labelledby="message-alerts-title"><h3 id="message-alerts-title">Messages</h3><ul>{inbox.items.map(n=><li key={n.id}><Link to={`/app/chat?conversation=${n.conversation_id}&message=${n.message_id}`} onClick={()=>dialog.current?.close()}><strong>{n.mentioned?`${n.sender_name} mentioned you`:`New message from ${n.sender_name}`}</strong>{n.title!==n.sender_name&&<span>in {n.title}</span>}<small>{chatTime(n.created_at)}</small></Link></li>)}</ul></section>}</dialog></>
}


