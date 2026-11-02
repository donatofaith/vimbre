import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {HandoverSections} from './HandoverBriefing'
import {emptySections} from './model'
it('renders selected sections in the same order as the handover and retains priority line breaks',()=>{const html=renderToStaticMarkup(<HandoverSections handover={{body:'Old body',sections:{...emptySections(),priorities:'1. Confirm delivery\n2. Check invoice',decisions:'Keep the supplier'}}}/>);expect(html.indexOf('What comes first')).toBeLessThan(html.indexOf('Decisions to keep'));expect(html).toContain('1. Confirm delivery\n2. Check invoice');expect(html).not.toContain('Old body');expect(html).not.toContain('<h3>Contacts</h3>')})
it('preserves unstructured handovers without inventing section content',()=>{const html=renderToStaticMarkup(<HandoverSections handover={{body:'Legacy handover <retained>',sections:emptySections()}}/>);expect(html).toContain('Legacy handover &lt;retained&gt;');expect(html).not.toContain('<section>')})
