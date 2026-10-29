import {describe,it,expect} from 'vitest'
import {messageReceipt} from './chat-types'
import type {Message} from './chat-types'
const message={sender_id:'me',seq:12,created_at:'2026-10-29T10:00:00Z'} as Message
describe('conversation read receipts',()=>{
 it('does not claim read or delivered without receipt data',()=>{
  expect(messageReceipt(message,[{id:'peer',full_name:'Peer'}])).toBe('Sent')
 })
 it('shows unread until the other participant reaches the message',()=>{
  expect(messageReceipt(message,[{id:'peer',full_name:'Peer',last_read_seq:11}])).toBe('Sent · Unread')
  expect(messageReceipt(message,[{id:'peer',full_name:'Peer',last_read_seq:12}])).toBe('Read')
 })
 it('counts group reads and excludes the sender, inactive and later participants',()=>{
  expect(messageReceipt(message,[{id:'me',full_name:'Me',last_read_seq:12},{id:'a',full_name:'A',last_read_seq:12},{id:'b',full_name:'B',last_read_seq:0},{id:'gone',full_name:'Gone',active:false,last_read_seq:0},{id:'later',full_name:'Later',last_read_seq:0,joined_at:'2026-10-29T11:00:00Z'}])).toBe('Read by 1 of 2')
 })
})
