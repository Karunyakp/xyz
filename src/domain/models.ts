export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type DataRow = { id: string; [key: string]: unknown };
export type Status =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';
export interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}
export interface CampusEvent extends DataRow {
  institution_id: string;
  created_by: string;
  title: string;
  description: string;
  objectives: string;
  category: string;
  event_type: string;
  mode: string;
  status: Status;
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
  timezone: string;
  capacity: number;
  venue_id: string | null;
  department_id: string | null;
  club_id: string | null;
  online_url: string;
  waitlist_enabled: boolean;
  manual_approval: boolean;
  is_team: boolean;
  team_min: number;
  team_max: number;
  allow_external: boolean;
  eligible_departments: string[];
  eligible_years: number[];
  questions: Question[];
  agenda: { time: string; title: string }[];
  faqs: { question: string; answer: string }[];
  rules: string;
  instructions: string;
  contact: string;
  cover_path: string | null;
  attachments: { name: string; path: string }[];
  estimated_budget: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}
export interface Registration extends DataRow {
  institution_id: string;
  event_id: string;
  user_id: string;
  status: string;
  registration_number: string;
  team_id: string | null;
  answers: Record<string, string>;
  invitation_expires_at: string | null;
  created_at: string;
}
export interface Institution extends DataRow {
  name: string;
  slug: string;
  logo_path: string | null;
  status: string;
  plan: string;
  settings: {
    timezone: string;
    allowed_domains: string[];
    external_registration: boolean;
    approval_required: boolean;
    approval_count: number;
    waitlist_hours: number;
  };
}
export interface Assignment {
  institution_id: string;
  user_id: string;
  role: string;
  scope_type: string;
  scope_id: string;
}
export interface Membership {
  institution_id: string;
  user_id: string;
  kind: string;
  department_id: string | null;
  status: string;
  student_number: string | null;
  academic_year: number | null;
}
export interface UserContext {
  profile: { id: string; full_name: string; bio: string; interests: string[]; skills: string[] };
  institutions: Institution[];
  memberships: Membership[];
  assignments: Assignment[];
  role_permissions: { role: string; permission: string }[];
  platform_admin: boolean;
}
export interface MetricPoint {
  name: string;
  value: number;
}
export interface Analytics {
  events: number;
  upcoming: number;
  pending: number;
  registrations: number;
  confirmed: number;
  attendance: number;
  capacity: number;
  unique_participants: number;
  category: MetricPoint[];
  departments: MetricPoint[];
  clubs: MetricPoint[];
  trend: MetricPoint[];
  monthly: MetricPoint[];
  finance: MetricPoint[];
}
export const categories = [
  'Technical',
  'Hackathon',
  'Workshop',
  'Seminar',
  'Cultural',
  'Sports',
  'Competition',
  'Entrepreneurship',
  'Industrial visit',
  'Career',
  'Volunteering',
  'External',
];
export const transitions: Record<Status, Status[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REVISION_REQUESTED', 'REJECTED'],
  REVISION_REQUESTED: ['PENDING_APPROVAL'],
  APPROVED: ['PUBLISHED'],
  REJECTED: ['PENDING_APPROVAL'],
  PUBLISHED: ['REGISTRATION_OPEN'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED'],
  REGISTRATION_CLOSED: ['ONGOING', 'REGISTRATION_OPEN'],
  ONGOING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};
export function can(
  context: UserContext | undefined,
  institutionId: string,
  permission: string,
  scope?: CampusEvent | string,
) {
  if (!context) return false;
  const assignments = context.assignments.filter(
    (a) =>
      a.institution_id === institutionId &&
      context.role_permissions.some((p) => p.role === a.role && p.permission === permission),
  );
  return assignments.some(
    (a) =>
      !scope ||
      (a.scope_type === 'institution' && a.scope_id === institutionId) ||
      (typeof scope === 'string'
        ? a.scope_id === scope
        : a.scope_id === scope.id ||
          (a.scope_type === 'department' && a.scope_id === scope.department_id) ||
          (a.scope_type === 'club' && a.scope_id === scope.club_id)),
  );
}
export function csvCell(value: unknown) {
  const s = String(value ?? '');
  return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
}
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
