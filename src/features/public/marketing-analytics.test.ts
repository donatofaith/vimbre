import {beforeEach,expect,it,vi} from 'vitest'
import {trackMarketing} from './marketing-analytics'
beforeEach(()=>vi.stubGlobal('window',{dataLayer:[],vimbreAnalytics:{consent:'accepted'}}))
it('pushes named interaction events for GTM without conversion flags',()=>{trackMarketing('cta_click',{location:'hero'});trackMarketing('tour_complete',{});expect(window.dataLayer).toEqual([{event:'cta_click',location:'hero'},{event:'tour_complete'}])})
it('does not send optional events without consent or arbitrary extra fields',()=>{trackMarketing('account_type_selected',{account_type:'individual',email:'private@example.com'} as never);expect(window.dataLayer).toEqual([{event:'account_type_selected',account_type:'individual'}]);window.vimbreAnalytics={consent:'declined',choose:()=>{}};trackMarketing('tour_start',{});expect(window.dataLayer).toHaveLength(1)})
