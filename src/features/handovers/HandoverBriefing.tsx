import {formatRecordDate} from '../records/record-utils'
import {sectionLabels,typeNames} from './model'
import type {Handover} from './model'

export function HandoverMeta({handover:h}:{handover:Handover}){
 return <dl className="ho-meta">{[['Type',typeNames[h.handover_type]],...(h.sections.reason?[['Reason',h.sections.reason]]:[]),['Owner',h.owner_name],['Cover person',h.cover_name||'Not set'],['Manager',h.reviewer_name||'Not set'],['Start date',formatRecordDate(h.starts_on)],['Return or last day',formatRecordDate(h.ends_on)]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
}
export function HandoverSections({handover:h}:{handover:Pick<Handover,'sections'|'body'>}){
 return <>{sectionLabels.filter(([key])=>h.sections?.[key]).map(([key,label])=><section key={key}><h3>{label}</h3><p className="record-text">{h.sections[key]}</p></section>)}{!Object.values(h.sections||{}).some(Boolean)&&h.body&&<p className="record-text">{h.body}</p>}</>
}
