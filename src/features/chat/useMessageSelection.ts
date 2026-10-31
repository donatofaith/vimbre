import {useEffect} from 'react'
/** Keep Android selection handles within the message where selection started. */
export function useMessageSelection(){
 useEffect(()=>{
  let scope:HTMLElement|null=null
  function start(event:PointerEvent){scope=event.target instanceof Element?event.target.closest<HTMLElement>('.chat-message-text'):null}
  function contain(){
   const selection=window.getSelection()
   if(!scope?.isConnected||!selection||selection.isCollapsed||!selection.rangeCount)return
   const range=selection.getRangeAt(0)
   if(!range.intersectsNode(scope)||scope.contains(range.startContainer)&&scope.contains(range.endContainer))return
   const backward=selection.anchorNode===range.endContainer&&selection.anchorOffset===range.endOffset
   const startNode=scope.contains(range.startContainer)?range.startContainer:scope
   const startOffset=startNode===scope?0:range.startOffset
   const endNode=scope.contains(range.endContainer)?range.endContainer:scope
   const endOffset=endNode===scope?scope.childNodes.length:range.endOffset
   if(backward)selection.setBaseAndExtent(endNode,endOffset,startNode,startOffset)
   else selection.setBaseAndExtent(startNode,startOffset,endNode,endOffset)
  }
  document.addEventListener('pointerdown',start,true);document.addEventListener('selectionchange',contain)
  return()=>{document.removeEventListener('pointerdown',start,true);document.removeEventListener('selectionchange',contain)}
 },[])
}
