export function WorkPrivacyNotice() {
  return <>You can see confirmed tasks and decisions. You cannot see private drafts or the original emails.</>
}

export function WorkVisibilityDetails({ team = false }: { team?: boolean }) {
  return <>
    <p><WorkPrivacyNotice /></p>
    <p>{team
      ? 'Managers can read responsibilities, workstreams, external contacts, document links, recurring deadlines, decisions, tasks, completion notes and archived records within their department. HR Admins can read these across the company.'
      : 'Managers in your department can read your responsibilities, workstreams, external contacts, document links, recurring deadlines, decisions, tasks, completion notes and archived records. Your company’s HR Admin can read these across the company.'}</p>
    <p>{team
      ? 'Each person can change their own work. Other employees and managers outside the department cannot read it. If someone has no department, only that person and company HR Admins can read their work.'
      : 'Only you can change your tasks. Managers outside your department and other employees cannot read them. If you have no department, only you and company HR Admins can read them.'}</p>
  </>
}
