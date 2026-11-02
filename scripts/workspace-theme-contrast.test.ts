import {readFileSync}from 'node:fs'
import {expect,it}from 'vitest'
const css=readFileSync(new URL('../src/features/appearance/workspace-theme.css',import.meta.url),'utf8')
function token(name:string){return css.match(new RegExp('--'+name+':(#[0-9a-f]+)'))![1]}
function light(hex:string){let v=hex.slice(1);if(v.length===3)v=v.split('').map(c=>c+c).join('');const rgb=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function contrast(a:string,b:string){const x=light(a),y=light(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
it('keeps regular text, muted text and links readable on every dark neutral surface',()=>{for(const bg of ['background','surface','surface-raised'])for(const fg of ['text','navy','muted','blue','blue-hover'])expect(contrast(token(fg),token(bg)),`${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)})
it('keeps primary actions and semantic feedback readable',()=>{expect(contrast(token('on-accent'),token('action-blue'))).toBeGreaterThanOrEqual(4.5);for(const [fg,bg]of [['success','theme-success-surface'],['error','theme-danger-surface'],['warning','theme-warning-surface']])expect(contrast(token(fg),token(bg))).toBeGreaterThanOrEqual(4.5)})
