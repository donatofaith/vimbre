export type Task = {
  id: string;
  updated_at?: string;
  repeat_rule?: {frequency:string;every_n?:number;unit?:string}|null;
  missed_at?: string | null;
  purged_at?: string | null;
  time_needed_minutes?: number | null;
  label?: string | null;
  steps?: string[];
  links?: string[];
  source_name?: string | null;
  source_connected?: boolean | null;
  source_date?: string | null;
  source_origin_url?: string | null;
  source_excerpt?: string | null;
  capture_excerpt?: string | null;
  decision_id?: string | null;
  decision_title?: string;
  priority?: "high" | "normal" | "low";
  pinned_at?: string | null;
  rank?: number;
  metadata?: {plan_day?:string;plan_order?:number;plan_reason?:string};
  capture_id?: string | null;
  capture_record_id?: string | null;
  stable_role_item_id?: string | null;
  source_role_profile_id?: string | null;
  source_role_id?: string | null;
  recurring_id?: string | null;
  source_role_kind?: string | null;
  created_at?: string;
  title: string;
  details: string;
  due_date: string | null;
  due_time: string | null;
  due_at: string;
  remind_at: string;
  status: "open" | "in_progress" | "done";
  source_kind:
    | "manual"
    | "email"
    | "notes"
    | "ai"
    | "recurring_deadline"
    | "role"
    | "meeting"
    | "handover"
    | "cover";
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
  overdue_rows?: Task[];
  counts: { today?: number; todo: number; progress: number; overdue: number; done?: number };
  tab_counts?: Record<string, number>;
  done_today?: Task[];
  upcoming?: Task[];
  undated?: Task[];
  review_assignments?: import('./suite-api').Assignment[];
  review_drafts?: {id:string;capture_id:string;kind:string;version:number;payload:Record<string,string|null>;duplicate:boolean}[];
  drafts_waiting?: number;
  decisions_waiting?: number;
  returning_handovers?: {id:string;title:string}[];
  handovers_waiting?: { id: string; title: string }[];
  covering?: { id: string; owner_id: string; owner_name: string }[];
  cover_tasks?: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    due_at: string | null;
    due_time?: string | null;
    priority?: string | null;
    label?: string | null;
    time_needed_minutes?: number | null;
    details?: string;
    steps?: string[];
    links?: string[];
    source_not_shared?: boolean;
    source_is_manual?: boolean;
    owner_id: string;
    owner_name: string;
  }[];
  checklist?: Record<"capture" | "role" | "reminder" | "cover", boolean>;
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
  role: "My role",
  meeting: "Meeting notes",
  handover: "Handover",
  cover: "Cover",
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
export function taskDate(task: Task, zone: string,language="en-GB",style:"short"|"medium"|"long"="medium") {
  if(!task.due_date&&!task.due_at)return "No date";
  const date = new Date(
    `${task.due_time ? dateInZone(zone, new Date(task.due_at)) : task.due_date}T12:00:00Z`,
  );
  const label = new Intl.DateTimeFormat(language, {
    dateStyle:style,
    timeZone: "UTC",
  }).format(date);
  return task.due_time
    ? `${label}, ${new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit", timeZone: zone }).format(new Date(task.due_at))}`
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
