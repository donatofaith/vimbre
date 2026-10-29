/** Read-receipt polling must not move a reader's selection or interrupt history. */
export function shouldFollowMessages(initial: boolean, nearBottom: boolean, selecting: boolean, previousSeq: number, latestSeq: number) {
  return !selecting && (initial || (nearBottom && latestSeq > previousSeq))
}
