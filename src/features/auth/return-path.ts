// Only a task identifier and an allowlisted review action survive the login handoff.
// Arbitrary URLs and other query parameters can never become redirect destinations.
export function myDayReturnPath(value:unknown){
 if(typeof value!=='string'||value.length>500)return '/app'
 const params=new URLSearchParams(value),task=params.get('task')
 if(!task||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task))return '/app'
 const result=new URLSearchParams({task}),action=params.get('task_action')
 if(action&&['done','snooze','reschedule','review'].includes(action))result.set('task_action',action)
 return `/app?${result}`
}
