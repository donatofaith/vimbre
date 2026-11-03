import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {useAuth} from '../auth/AuthProvider'
import {StarsPanel} from './StarsPanel'
import {SegmentedControl} from '../../components/ui/SegmentedControl'
import {PeriodPicker} from './PeriodPicker'
import {reportPeriod,type PeriodMode} from './report-period'
import {WorkSummary,type SummaryDraft} from './WorkSummary'
import {dateInZone} from './types'
export function WeeklySummaryPage(){
 const {profile}=useAuth()
 const [drafts,setDrafts]=useState<Record<string,SummaryDraft>>({})
 const [tab,setTab]=useState(new URLSearchParams(window.location.search).get('tab')==='stars'?'stars':'summary')
 const [zone,setZone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
 const [mode,setMode]=useState<PeriodMode>('week'),[day,setDay]=useState(()=>dateInZone(Intl.DateTimeFormat().resolvedOptions().timeZone))
 const today=dateInZone(zone),range=reportPeriod(day,mode),rangeKey=range.start+':'+range.end
 const saveDraft=useCallback((value:SummaryDraft)=>setDrafts(all=>({...all,[rangeKey]:value})),[rangeKey])
 useEffect(()=>{let live=true;void supabase.rpc('myday_preferences',{}).then(({data})=>{const prefs=data as {timezone?:string}|null;if(live&&prefs?.timezone){setZone(prefs.timezone);setDay(dateInZone(prefs.timezone))}});return()=>{live=false}},[profile?.id])
 return <section className="md-work-section weekly-summary-page"><h1 tabIndex={-1}>{tab==='stars'?'Stars':mode==='month'?'Monthly summary':'Weekly summary'}</h1><SegmentedControl label="Summary view"value={tab}onChange={setTab}options={[{value:'summary',label:'Summary'},{value:'stars',label:'Stars'}]}/>{tab==='stars'?<StarsPanel/>:<><PeriodPicker mode={mode}day={day}today={today}onChange={(m,d)=>{setMode(m);setDay(d)}}/><WorkSummary key={range.start+':'+range.end}start={range.start}end={range.end}initial={drafts[range.start+':'+range.end]}changed={saveDraft}/></>}</section>
}
