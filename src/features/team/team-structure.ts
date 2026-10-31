export type WorkspaceStructure={plan:string;team_mode:string}
const labels:Record<string,string>={free:'Free',trial:'Trial',starter:'Starter',growth:'Growth',business:'Business',enterprise:'Enterprise'}
export function workspaceStructureLabel(value:WorkspaceStructure){
 const plan=labels[value.plan]??'Current plan'
 return `${plan} · ${value.team_mode==='departments'?'Departments':'Departments optional'}`
}
