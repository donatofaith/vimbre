import { useAuth } from '../auth/AuthProvider'
import { AIDraftPanel } from './AIDraftPanel'
import { loadOwnRecords } from './load-records'
export function HandoverDraftPage() {
  const { profile, company } = useAuth()
  return <><h1 tabIndex={-1}>Handovers</h1><p>Prepare a handover draft from your records or notes. Approval and publishing are not available yet.</p><AIDraftPanel key={profile!.id} task="handover_draft" loadRecords={() => loadOwnRecords(profile!.id, company!.id)} /></>
}
