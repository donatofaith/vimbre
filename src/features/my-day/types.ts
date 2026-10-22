export type Task = {
  id: string;
  title: string;
  details: string;
  due_date: string;
  due_time: string | null;
  due_at: string;
  remind_at: string;
  status: "open" | "in_progress" | "done";
  source_kind: "manual" | "email" | "notes" | "ai" | "recurring_deadline";
  source_url: string | null;
  completion_note: string;
  completed_at: string | null;
  deleted_at: string | null;
  department_id: string | null;
  external_contact_id: string | null;
  department_name?: string;
  external_contact_name?: string;
  reminder_option: string;
  context_added_at: string | null;
  context_kind: string | null;
  context_record_id: string | null;
};
export type ForOption = {
  id: string;
  kind: "department" | "contact";
  name: string;
  label: string;
};
export type DayData = {
  rows: Task[];
  count: number;
  today: string;
  timezone: string;
  counts: { todo: number; progress: number; overdue: number };
  has_work: boolean;
  context_waiting: Task[];
};
export const statuses = [
  ["open", "To do"],
  ["in_progress", "In progress"],
  ["done", "Done"],
] as const;
export const sourceLabels = {
  manual: "Manual",
  email: "Email",
  notes: "Notes",
  ai: "Vimbre AI",
  recurring_deadline: "Recurring deadline",
};
export function dateInZone(zone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function taskDate(task: Task, zone: string) {
  const date = new Date(`${task.due_date}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return task.due_time
    ? `${label}, ${new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: zone }).format(new Date(task.due_at))}`
    : label;
}
export function greetingInZone(zone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: zone,
    }).format(new Date()),
  );
  return hour < 12
    ? "Good morning"
    : hour < 16
      ? "Good afternoon"
      : "Good evening";
}
export function parseDay(value: unknown): DayData | null {
  if (!value || typeof value !== "object") return null;
  const v = value as DayData;
  return Array.isArray(v.rows) &&
    Array.isArray(v.context_waiting) &&
    typeof v.timezone === "string" &&
    typeof v.today === "string" &&
    Number.isSafeInteger(v.count) &&
    v.counts &&
    Object.values(v.counts).every(Number.isSafeInteger)
    ? v
    : null;
}
