import {expect,it,vi}from 'vitest'
import {renderToStaticMarkup}from 'react-dom/server'
import {MemoryRouter}from 'react-router-dom'
import {AskVimbreAI}from './AskVimbreAI'
import {MemberAvatar}from '../people/MemberAvatar'
it('renders a chat log with a compact composer and an empty controlled input',()=>{const html=renderToStaticMarkup(<MemoryRouter><AskVimbreAI back={vi.fn()}/></MemoryRouter>);expect(html).toContain('role="log"');expect(html).toContain('aria-label="AI conversation"');expect(html).toContain('placeholder="Message VimbreAI…"');expect(html).toMatch(/<textarea[^>]*><\/textarea>/);expect(html).toContain('aria-label="Send to VimbreAI"');expect(html).not.toContain('rows="3"')})
it('announces presence without relying on colour alone',()=>{for(const presence of ['active','away','offline']as const){const html=renderToStaticMarkup(<MemberAvatar member={{id:'a',full_name:'Alex Reed',presence}}/>);expect(html).toContain(`data-presence="${presence}"`);expect(html).toContain('aria-label="Alex Reed · ');expect(html).toContain('AR')}})
