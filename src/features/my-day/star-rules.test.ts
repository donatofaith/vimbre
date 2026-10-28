import {it,expect} from 'vitest'
import {previewTaskStars} from './star-rules'
const input={createdAt:0,completedAt:600000,hasDueDate:true,deleted:false,splitFromTask:false,priority:'normal' as const,plannedMinutes:30,covering:false,firstPriority:false,early:false,decisionReason:false,alreadyEarned:0}
it('requires ten minutes, a due date and retained unsplit work',()=>{expect(previewTaskStars(input)).toBe(1);for(const patch of [{completedAt:599999},{hasDueDate:false},{deleted:true},{splitFromTask:true}])expect(previewTaskStars({...input,...patch})).toBe(0)})
it('doubles cover credit and enforces the daily cap',()=>{expect(previewTaskStars({...input,covering:true})).toBe(2);expect(previewTaskStars({...input,covering:true,alreadyEarned:14})).toBe(1);expect(previewTaskStars({...input,alreadyEarned:16})).toBe(0)})
it('weights duration and priority rather than counting tasks alone',()=>{expect(previewTaskStars({...input,priority:'high',plannedMinutes:60})).toBeGreaterThan(previewTaskStars({...input,priority:'low',plannedMinutes:10}))})
