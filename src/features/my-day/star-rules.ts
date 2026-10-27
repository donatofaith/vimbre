// Kept off until the integer-credit migration is installed and verified.
export const starsScoringReady = false
/** Preview only. Awards must be validated and deduplicated on the server. */
export type StarInput={createdAt:number;completedAt:number;hasDueDate:boolean;deleted:boolean;splitFromTask:boolean;priority:'high'|'normal'|'low';plannedMinutes:number;covering:boolean;firstPriority:boolean;early:boolean;decisionReason:boolean;alreadyEarned:number}
export function previewTaskStars(input:StarInput){
 if(input.deleted||input.splitFromTask||!input.hasDueDate||!Number.isFinite(input.completedAt-input.createdAt)||input.completedAt-input.createdAt<600000)return 0
 const minutes=Number.isFinite(input.plannedMinutes)?input.plannedMinutes:10
 const weight=({high:1.5,normal:1,low:.5})[input.priority]*Math.max(10,Math.min(480,minutes))/30
 const base=1+(input.firstPriority?1:0)+(input.early?1:0)+(input.decisionReason?1:0)
 return Math.max(0,Math.min(15-Math.max(0,input.alreadyEarned),Math.floor(base*weight*(input.covering?2:1))))
}
export const starsDisclosure='Stars recognise selected activity in Vimbre. They do not measure the quality, difficulty or full value of your work. Stars are not a performance score and should not be used in reviews, pay or ratings. Your company must enable competition, and you choose whether to appear. Hidden work, leave and absence must not be treated as poor performance.'
