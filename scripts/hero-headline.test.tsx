import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {HeroHeadline} from '../src/features/public/HeroHeadline'
it('renders the updated unquoted headline',()=>{const html=renderToStaticMarkup(<HeroHeadline/>);expect(html).toContain('Understand the why');expect(html).toContain('>the why</span>');expect(html).not.toMatch(/[“”]|Priorities/)})
