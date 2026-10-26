import {createContext,useContext} from 'react'
export type TaskFormat={language:string;style:'short'|'medium'|'long'}
export const TaskFormatContext=createContext<TaskFormat>({language:'en-GB',style:'medium'})
// oxlint-disable-next-line react/only-export-components -- Shared task date preferences.
export function useTaskFormat(){return useContext(TaskFormatContext)}
export function formatTaskDay(value:string|null|undefined,format:TaskFormat){if(!value)return 'No date';const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())?new Intl.DateTimeFormat(format.language,{dateStyle:format.style,timeZone:'UTC'}).format(d):value}
