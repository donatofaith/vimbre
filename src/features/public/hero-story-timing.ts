// The revised story has two plays. Scene timings are declared once here.
export const heroStoryTiming = {
  desktop: { duration: 13.2, arrival: 0, capture: 2.2, draft: 4.4, saved: 6.6, away: 8, cover: 9.4, resolve: 11.4, reset: 12.6 },
  mobile: { duration: 9, arrival: 0, capture: 1.4, draft: 2.8, saved: 4.4, away: 5.4, cover: 6.4, resolve: 7.6, reset: 8.5 },
  plays: 2,
  transition: .45,
  rowStagger: .1,
  coverStagger: .08,
  cursor: 1,
  click: .4,
  camera: 1.2,
  resetDuration: .5,
} as const
