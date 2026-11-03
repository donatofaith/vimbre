import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {HeroHeadline} from '../src/features/public/HeroHeadline'
import {headline} from '../src/features/public/public-content'
it('announces the full sentence once and hides animated words from assistive technology',()=>{const html=renderToStaticMarkup(<HeroHeadline index={2}/>);expect(html.match(/<h1/g)).toHaveLength(1);expect(html).toContain('<span class="sr-only">'+headline+'</span>');expect(html).toContain('aria-hidden="true" class="rf-rotating-word"><span>decisions.</span>')})
