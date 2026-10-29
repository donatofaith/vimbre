import {describe,it,expect} from 'vitest'
import {mentionAt,insertMention,bodyMentions,mentionParts} from './chat-mentions'
const people=[{id:'a',full_name:'Faith Ayomikun',active:true},{id:'b',full_name:'Faith Oluwalana',active:true},{id:'c',full_name:'Former User',active:false}]
describe('chat mention recipients',()=>{
 it('ends a selected name before subsequent words and opens a new @ search',()=>{
  const text=insertMention('Hi @Fa',6,'Faith Ayomikun').text+'please check this'
  expect(mentionAt(text,text.length,['Faith Ayomikun'])).toBeNull()
  expect(bodyMentions(text,people)).toEqual(['a'])
  expect(mentionAt(text+' @Faith O',text.length+9,['Faith Ayomikun'])?.query).toBe('Faith O')
 })
 it('renders each mention once inline and leaves unmentioned text untouched',()=>{
  const text='Hello @Faith Ayomikun, please check <script> and hello@example.com.'
  const parts=mentionParts(text,[{id:'a',name:'Faith Ayomikun'}])
  expect(parts.filter(p=>p.id)).toEqual([{id:'a',text:'@Faith Ayomikun'}])
  expect(parts.map(p=>p.text).join('')).toBe(text)
 })
 it('recognises a name being typed at the cursor, not an email address',()=>{
  expect(mentionAt('Hi @Faith A',11)?.query).toBe('Faith A')
  expect(mentionAt('hello@example.com',17)).toBeNull()
 })
 it('inserts the selected full name while preserving text after the cursor',()=>{
  expect(insertMention('Hi @Fa please review',6,'Faith Ayomikun').text).toBe('Hi @Faith Ayomikun  please review')
 })
 it('resolves exact active participants and rejects partial names, outsiders and self',()=>{
  expect(bodyMentions('@Faith Ayomikun, please review. @Former User @Unknown',people)).toEqual(['a'])
  expect(bodyMentions('@Faith',people)).toEqual([])
  expect(bodyMentions('@Faith Ayomikun',people,'a')).toEqual([])
 })
 it('does not guess a recipient when two participants have the same display name',()=>{
  expect(bodyMentions('@Faith Ayomikun',[...people,{id:'d',full_name:'Faith Ayomikun'}])).toEqual([])
 })
})
