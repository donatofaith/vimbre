export const navigation = [
  { label: 'My day', path: '/app', end: true },
  { label: 'Capture', path: '/app/capture' },
  { label: 'Role record', path: '/app/role-record' },
  { label: 'Handovers', path: '/app/handovers' },
  { label: 'Cover duties', path: '/app/my-cover-duties' },
  { label: 'Team', path: '/app/team', available: true, leaders: true },
  { label: 'Departments', path: '/app/departments', available: true, leaders: true },
  { available: true, label: 'Settings', path: '/app/settings' },
] as const
