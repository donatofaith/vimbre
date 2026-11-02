import{expect,it}from'vitest'
import{starLevelProgress,starLevels}from'../src/features/my-day/star-levels'
it('requires 50 qualifying tasks for the first badge and increments each by 50',()=>{expect(starLevels.map(x=>x.tasks)).toEqual([50,100,150,200,250]);expect(starLevelProgress(49)).toMatchObject({index:-1,next:{name:'Starter'},remaining:1});expect(starLevelProgress(50)).toMatchObject({current:{name:'Starter'},remaining:50,progress:0});expect(starLevelProgress(100).current.name).toBe('Steady');expect(starLevelProgress(250)).toMatchObject({current:{name:'Anchor'},next:undefined,progress:100})})
it('does not grant a badge for invalid or negative totals',()=>{expect(starLevelProgress(-1).index).toBe(-1);expect(starLevelProgress(NaN).remaining).toBe(50)})
