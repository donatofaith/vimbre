/** Uses the viewer's local browser timezone. Evening starts at 4 pm by request. */
export function localGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 16) return 'Good afternoon'
  return 'Good evening'
}
