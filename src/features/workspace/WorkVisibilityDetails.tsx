export function WorkPrivacyNotice() {
  return <>You can see confirmed tasks and decisions. You cannot see private drafts or the original emails.</>
}
export function WorkVisibilityDetails({team=false}:{team?:boolean}) {
  return <><p><WorkPrivacyNotice /></p><h3>Task fields managers can see</h3><ul><li>Title</li><li>Status</li><li>Due date</li><li>Department</li></ul><p>{team ? 'Managers see tasks within their department. Company administrators see tasks across the company.' : 'Your department manager and company administrators can see these task fields.'}</p><h3>What stays private</h3><p>Task details, original emails, source links, Capture drafts, personal notes and unsaved AI drafts.</p><p>Role records and confirmed decisions follow your company’s existing access rules. Only the task owner can change their tasks.</p></>
}
