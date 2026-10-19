import { createContext, useContext } from 'react'
import { emptyInbox } from './chat-types'
import type { ChatInbox } from './chat-types'
export const ChatContext=createContext<{inbox:ChatInbox; revision:number; refresh:()=>void; error:boolean}>({inbox:emptyInbox,revision:0,refresh:()=>{},error:false})
export const useChat=()=>useContext(ChatContext)
