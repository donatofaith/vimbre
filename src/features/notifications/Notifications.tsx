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
 const tasks=useTaskAlerts()
 const work=useWorkNotifications(page)
 const dialog=useRef<HTMLDialogElement>(null)
 const unread=inbox.unread+work.data.unread+tasks.rows.length
 return <><button className="chat-bell" type="button" aria-label={`Notifications${unread?`, ${unread} unread`:''}`} onClick={()=>{work.refresh();refreshChat();tasks.refresh();dialog.current?.showModal()}}><WorkspaceIcon name="bell"/>{unread>0&&<span className="chat-count">{unread>99?'99+':unread}</span>}</button>
 <dialog ref={dialog} className="vw-dialog chat-notifications" aria-labelledby="workspace-notifications-title"><div className="chat-dialog-heading"><h2 id="workspace-notifications-title">Notifications</h2><button className="button button-secondary" onClick={()=>dialog.current?.close()}>Close</button></div>
 {work.error&&<p role="alert" className="field-error">Deadline reminders could not be loaded. <button type="button" onClick={work.refresh}>Retry</button></p>}
 {work.readError&&<p role="alert" className="field-error">The notification could not be marked as read. Please retry.</p>}
 {chatError&&<p role="alert" className="field-error">Message notifications could not be refreshed. <button type="button" onClick={refreshChat}>Retry</button></p>}
 {work.loading&&<p role="status">Loading reminders…</p>}
 {!work.error&&!chatError&&!work.loading&&work.data.count===0&&inbox.items.length===0&&tasks.rows.length===0&&<p>No unread notifications.</p>}
 {tasks.error&&<p role="alert" className="field-error">Task reminders could not be loaded. <button onClick={tasks.refresh}>Retry task reminders</button></p>}
 {tasks.rows.length>0&&<TaskAlerts alerts={tasks.rows} zone={tasks.zone} changed={tasks.refresh} close={()=>dialog.current?.close()}/>}
 {work.data.count>0&&<section aria-labelledby="deadline-alerts-title"><h3 id="deadline-alerts-title">Deadlines</h3><ul>{work.data.items.map(n=><li key={n.notification_key} className="work-notification" data-unread={!n.read_at}><Link to={reminderPath(n)} onClick={()=>{void work.markRead(n.notification_key);dialog.current?.close()}}><span className={`deadline-stage deadline-stage-${n.stage}`}>{reminderLabel(n)}</span><strong>{n.title}</strong><span>{n.source_kind==='task'?'Task':n.section==='responsibility'?'Responsibility':'Recurring deadline'} · {reminderDate(n.due_date)}</span></Link>{!n.read_at&&<button type="button" className="work-mark-read" disabled={Boolean(work.busy)} onClick={()=>{void work.markRead(n.notification_key)}} aria-label={`Mark ${n.title} as read`}>{work.busy===n.notification_key?'Saving…':'Mark as read'}</button>}</li>)}</ul><div className="notification-pages">{page>0&&<button className="button button-secondary" onClick={()=>setPage(p=>p-1)}>Previous reminders</button>}{(page+1)*50<work.data.count&&<button className="button button-secondary" onClick={()=>setPage(p=>p+1)}>More reminders</button>}</div></section>}
 {inbox.items.length>0&&<section aria-labelledby="message-alerts-title"><h3 id="message-alerts-title">Messages</h3><ul>{inbox.items.map(n=><li key={n.id}><Link to={`/app/chat?conversation=${n.conversation_id}&message=${n.message_id}`} onClick={()=>dialog.current?.close()}><strong>{n.mentioned?`${n.sender_name} mentioned you`:`New message from ${n.sender_name}`}</strong>{n.title!==n.sender_name&&<span>in {n.title}</span>}<small>{chatTime(n.created_at)}</small></Link></li>)}</ul></section>}</dialog></>
}

