import{expect,it}from'vitest'
import{starLevelProgress}from'../src/features/my-day/star-levels'
it('uses qualifying task counts rather than weighted stars for level progress',()=>{expect(starLevelProgress(9)).toMatchObject({current:{name:'Starter'},next:{name:'Steady'},remaining:1});expect(starLevelProgress(10)).toMatchObject({current:{name:'Steady'},next:{name:'Sharp'},remaining:15,progress:0});expect(starLevelProgress(24)).toMatchObject({current:{name:'Steady'},remaining:1});expect(starLevelProgress(60)).toMatchObject({current:{name:'Anchor'},next:undefined,progress:100})})
it('keeps invalid or negative totals from unlocking badges',()=>{expect(starLevelProgress(-1).current.name).toBe('Starter');expect(starLevelProgress(NaN).remaining).toBe(10)})
