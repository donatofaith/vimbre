export function WorkspaceIcon({
  name = 'record',
}: {
  name?: string
}) {
  const paths: Record<string, string> = {
    chat: 'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5',
    bell: 'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3z M10 21h4',
    home: 'M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
    capture: 'M12 3v12 M8 11l4 4 4-4 M4 16v5h16v-5',
    record:
      'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6',
    handover:
      'M4 7h15 M15 3l4 4-4 4 M20 17H5 M9 13l-4 4 4 4',
    people:
      'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21v-3a7 7 0 0 1 14 0v3 M19 5a3 3 0 0 1 0 6 M22 21v-3a6 6 0 0 0-3-5',
    cover: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
    departments: 'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
    projects: 'M3 7h7l2-3h9v17H3z M3 10h18',
    tick: 'M5 12l4 4L19 6',
    settings:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
    exit: 'M10 3H4v18h6 M10 12h11 M17 8l4 4-4 4',
    arrow: 'M4 12h16 M14 6l6 6-6 6',
    plus: 'M12 5v14 M5 12h14',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    calendar: 'M4 5h16v16H4z M8 3v5 M16 3v5 M4 10h16',
    check: 'M4 7l2 2 4-5 M13 7h7 M4 15l2 2 4-5 M13 15h7',
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.record} />
    </svg>
  )
}
