// The hero story is designed as one restrained ten-second loop.
export const heroStoryTiming = {
  desktop: { duration: 10, capture: 1.15, draft: 2.95, confirmed: 4.65, saved: 5.7, away: 6.65, cover: 7.55, resolve: 8.5, reset: 9.45 },
  mobile: { duration: 10, capture: 1.15, draft: 2.95, confirmed: 4.65, saved: 5.7, away: 6.65, cover: 7.55, resolve: 8.5, reset: 9.45 },
  plays: Infinity,
  transition: .5,
  rowStagger: .06,
  coverStagger: .06,
} as const
