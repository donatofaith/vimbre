import {useState} from 'react'
import {StarsPanel} from './StarsPanel'
import {SegmentedControl} from '../../components/ui/SegmentedControl'
import { useAuth } from "../auth/AuthProvider";
import { AIDraftPanel } from "../ai/AIDraftPanel";
import { loadOwnRecords } from "../ai/load-records";
export function WeeklySummaryPage() {
  const { profile, company } = useAuth();
  const [tab,setTab]=useState(new URLSearchParams(window.location.search).get("tab")==="stars"?"stars":"summary");
  return (
    <section className="md-work-section">
      <h1 tabIndex={-1}>Weekly summary</h1>
      <SegmentedControl label="Weekly view" value={tab} onChange={setTab} options={[{value:"summary",label:"Summary"},{value:"stars",label:"Stars"}]}/>
      {tab==="stars"?<StarsPanel/>:<AIDraftPanel
        task="weekly_summary"
        showHeading={false}
        loadRecords={() => loadOwnRecords(profile!.id, company!.id)}
      />}
    </section>
  );
}
