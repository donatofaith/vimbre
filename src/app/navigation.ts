export const navigation = [
  { label: 'My day', path: '/app', end: true },
  { label: 'Team activity', path: '/app/team-activity', available: true, leaders: true },
  { label: 'Capture', path: '/app/capture' },
  { label: 'My role', path: '/app/role-record', available: true },
  { label: 'Handovers', path: '/app/handovers' },
  { label: 'Weekly summary', path: '/app/weekly-summary', available: true },
  { label: 'Cover duties', path: '/app/my-cover-duties' },
  { label: 'Team', path: '/app/team', available: true, leaders: true },
  { label: 'Departments', path: '/app/departments', available: true, leaders: true },
  { available: true, label: 'Settings', path: '/app/settings' },
] as const

