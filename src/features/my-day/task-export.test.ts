import {it,expect} from 'vitest'
import {csvCell,parseCSV,taskCalendar} from './task-export'
import type {Task} from './types'
it('imports quoted multiline details and escaped quotes',()=>{expect(parseCSV('title,details\r\n"Review","First line\nSecond ""quote"""')).toEqual([{title:'Review',details:'First line\nSecond "quote"'}])})
it('rejects malformed columns, invalid calendar dates and invalid hours before import',()=>{for(const value of ['title,title\na,b','title,due_date\nReview,2026-02-30','title,due_time\nReview,27:00'])expect(()=>parseCSV(value)).toThrow()})
it('neutralises spreadsheet formulas even after leading whitespace',()=>{for(const value of ['=1+1',' +SUM(A1:A2)','\t@SUM(A1:A2)','-4'])expect(csvCell(value).startsWith('"\'')).toBe(true)})
it('folds calendar lines without allowing titles to inject properties',()=>{const result=taskCalendar({id:'task',title:'Résumé '.repeat(30)+'\rATTENDEE:secret',due_date:'2026-10-26',updated_at:'2026-10-26T09:00:00Z'} as Task);for(const line of result.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);expect(result).not.toContain('\rATTENDEE:')})
