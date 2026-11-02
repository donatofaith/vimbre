import {afterEach,beforeEach,expect,it,vi}from 'vitest'
let api:typeof import('./theme'),stored:Map<string,string>,browser:EventTarget&{localStorage:unknown;matchMedia:unknown}
beforeEach(async()=>{vi.resetModules();stored=new Map();browser=Object.assign(new EventTarget(),{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)},matchMedia:()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})});vi.stubGlobal('window',browser);api=await import('./theme')})
afterEach(()=>vi.unstubAllGlobals())
it('restores either explicit mode ahead of the system preference',()=>{stored.set(api.themeKey,'dark');expect(api.workspaceTheme()).toBe('dark');stored.set(api.themeKey,'light');expect(api.workspaceTheme()).toBe('light')})
it('follows the system until the user chooses a mode',()=>{browser.matchMedia=()=>({matches:true});expect(api.workspaceTheme()).toBe('dark');api.setWorkspaceTheme('light');expect(api.workspaceTheme()).toBe('light');expect(stored.get(api.themeKey)).toBe('light')})
it('updates subscribers and works with blocked storage',()=>{const changed=vi.fn(),cleanup=api.subscribeTheme(changed);browser.localStorage={getItem(){throw Error()},setItem(){throw Error()}};api.setWorkspaceTheme('dark');expect(api.workspaceTheme()).toBe('dark');expect(changed).toHaveBeenCalledOnce();cleanup();api.setWorkspaceTheme('light');expect(changed).toHaveBeenCalledOnce()})
it('is safe during server rendering',()=>{vi.stubGlobal('window',undefined);expect(api.workspaceTheme()).toBe('light')})
