// Standard-density review captures are present. Native 2x export remains pending; use the 1x fallback without upscaling.
/** All public screenshots and tour steps come from this verified manifest. */
export type WalkthroughStep = {id:string;title:string;oneLine:string;featureTag:string;lastVerified:string;screenshots:{desktop:{oneX:string;twoX:string};mobile:{oneX:string;twoX:string}};route:string;hotspot:{x:number;y:number;label:string}}
const screen=(id:string)=>({desktop:{oneX:`/walkthrough/${id}-desktop.png`,twoX:`/walkthrough/${id}-desktop.png`},mobile:{oneX:`/walkthrough/${id}-mobile.png`,twoX:`/walkthrough/${id}-mobile.png`}})
export const walkthrough:WalkthroughStep[]=[
 {id:'conversations',title:'Conversations',oneLine:'Bring in a conversation and review the suggested tasks and decisions.',featureTag:'Capture',route:'/app/capture',hotspot:{x:72,y:61,label:'Review the suggested tasks'},lastVerified:'2026-11-03',screenshots:screen('conversations')},
 {id:'tasks',title:'Tasks',oneLine:'Choose what needs attention today, with your tasks and due dates together.',featureTag:'My day',route:'/app',hotspot:{x:62,y:57,label:'See the tasks for today'},lastVerified:'2026-11-03',screenshots:screen('tasks')},
 {id:'decisions',title:'Decisions',oneLine:'Keep what was agreed, who decided and why it matters.',featureTag:'My role',route:'/app/role-record?section=decision',hotspot:{x:65,y:48,label:'Read the recorded decision'},lastVerified:'2026-11-03',screenshots:screen('decisions')},
 {id:'contacts',title:'Contacts',oneLine:'Keep the people someone needs to contact with the work they help with.',featureTag:'My role',route:'/app/role-record?section=external_contact',hotspot:{x:65,y:48,label:'See the supplier contact'},lastVerified:'2026-11-03',screenshots:screen('contacts')},
 {id:'handovers',title:'Handovers',oneLine:'Select the work, check the summary and prepare it for the person covering.',featureTag:'Handovers',route:'/app/handovers/77777777-7777-4777-8777-777777777777',hotspot:{x:71,y:55,label:'Review the handover'},lastVerified:'2026-11-03',screenshots:screen('handovers')},
 {id:'week',title:'Week',oneLine:'Review completed work, open tasks and decisions for the selected period.',featureTag:'Weekly summary',route:'/app/weekly-summary',hotspot:{x:62,y:45,label:'Read the weekly summary'},lastVerified:'2026-11-03',screenshots:screen('week')},
]
