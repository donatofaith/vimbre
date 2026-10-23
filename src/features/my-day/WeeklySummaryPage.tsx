import { useAuth } from "../auth/AuthProvider";
import { AIDraftPanel } from "../ai/AIDraftPanel";
import { loadOwnRecords } from "../ai/load-records";
export function WeeklySummaryPage() {
  const { profile, company } = useAuth();
  return (
    <section className="md-work-section">
      <h1 tabIndex={-1}>Weekly summary</h1>
      <AIDraftPanel
        task="weekly_summary"
        loadRecords={() => loadOwnRecords(profile!.id, company!.id)}
      />
    </section>
  );
}
