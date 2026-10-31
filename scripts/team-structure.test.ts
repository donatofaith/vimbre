import {expect,it} from 'vitest'
import {workspaceStructureLabel} from '../src/features/team/team-structure'
it('shows Business with the actual optional department setup rather than Small team',()=>{expect(workspaceStructureLabel({plan:'business',team_mode:'small'})).toBe('Business · Departments optional')})
it('preserves configured departments for every plan',()=>{expect(workspaceStructureLabel({plan:'business',team_mode:'departments'})).toBe('Business · Departments');expect(workspaceStructureLabel({plan:'free',team_mode:'departments'})).toBe('Free · Departments')})
