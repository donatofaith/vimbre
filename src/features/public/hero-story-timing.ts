// Every illustrated click precedes its scene change. One timeline owns the tour.
export const heroStoryTiming = {
  desktop: { duration: 16.1, capture: 2, draft: 4.3, confirmed: 6.5, saved: 8, away: 10, cover: 12, resolve: 14, reset: 15.5 },
  mobile: { duration: 16.1, capture: 2, draft: 4.3, confirmed: 6.5, saved: 8, away: 10, cover: 12, resolve: 14, reset: 15.5 },
  plays: 2,
  transition: .35,
  rowStagger: .1,
  coverStagger: .08,
} as const
