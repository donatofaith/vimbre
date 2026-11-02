import {readFileSync}from 'node:fs'
import {runInNewContext}from 'node:vm'
import {expect,it}from 'vitest'
const source=readFileSync(new URL('../public/workspace-theme.js',import.meta.url),'utf8')
function boot(path:string,saved:string|null,system=false){const dataset:Record<string,string>={};runInNewContext(source,{location:{pathname:path},localStorage:{getItem:()=>saved},matchMedia:()=>({matches:system}),document:{documentElement:{dataset},querySelector:()=>null}});return dataset}
it('paints the selected workspace theme before React loads',()=>{expect(boot('/app','dark')).toEqual({workspaceTheme:'dark'});expect(boot('/app/chat','light',true)).toEqual({workspaceTheme:'light'})})
it('keeps public and authentication pages in their existing theme',()=>{for(const path of ['/','/login','/signup','/app-not-workspace'])expect(boot(path,'dark')).toEqual({})})
it('uses the system preference only without an explicit choice',()=>{expect(boot('/app',null,true).workspaceTheme).toBe('dark');expect(boot('/app',null,false).workspaceTheme).toBe('light')})
