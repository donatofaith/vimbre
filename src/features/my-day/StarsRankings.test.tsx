import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {StarsRankings} from './StarsRankings'
const team=[{name:'Operations',average:0,members:1}]
const earned=[{id:'earned',full_name:'Teammate',stars:3}]
describe('weekly earned positions',()=>{
 it('does not display a rank against an empty weekly leaderboard',()=>{const html=renderToStaticMarkup(<StarsRankings rank={1} ranking={[]} teams={team}/>);expect(html).not.toContain('Your position');expect(html).toContain('No opted-in team members have earned stars this week.');expect(html).toContain('Team averages');expect(html).toContain('Operations')})
 it('does not rank zero star rows from an older response',()=>{const html=renderToStaticMarkup(<StarsRankings rank={1} ranking={[{id:'zero',full_name:'Zero member',stars:0}]} teams={[]}/>);expect(html).not.toContain('Your position');expect(html).not.toContain('Zero member')})
 it('preserves an earned position and positive leaderboard',()=>{const html=renderToStaticMarkup(<StarsRankings rank={4} ranking={earned} teams={[]}/>);expect(html).toContain('Your position');expect(html).toContain('#4');expect(html).toContain('Teammate')})
 it.each([null,0,-1,NaN])('does not invent a position for %s',rank=>{expect(renderToStaticMarkup(<StarsRankings rank={rank} ranking={earned} teams={[]}/>)).not.toContain('Your position')})
})
