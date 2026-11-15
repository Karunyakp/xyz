import { db, rpc, appUrl } from '../infrastructure/supabase';
import { one, rows } from './repository';
import type { Analytics, CampusEvent, DataRow, Registration, UserContext } from '../domain/models';
export const authService = {
  context: () => rpc<UserContext>('my_context'),
  login: async (email: string, password: string) => {
    const { error } = await db().auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  signup: async (email: string, password: string, full_name: string, requested_role = 'student') => {
    const { error } = await db().auth.signUp({
      email,
      password,
      options: {
        data: { full_name, requested_role },
        emailRedirectTo: appUrl + '/auth/callback',
      },
    });
    if (error) throw error;
  },
  reset: async (email: string) => {
    const { error } = await db().auth.resetPasswordForEmail(email, {
      redirectTo: appUrl + '/reset-password',
    });
    if (error) throw error;
  },
  password: async (password: string) => {
    const { error } = await db().auth.updateUser({ password });
    if (error) throw error;
  },
  logout: async () => {
    const { error } = await db().auth.signOut();
    if (error) throw error;
  },
  accept: () => rpc<number>('accept_invitations'),
};
export const institutionService = {
  term: (i: string, p: unknown, record_id?: string) =>
    rpc<string>('save_academic_term', { i, p, record_id }),
  join: (slug_value: string) => rpc<string>('join_institution', { slug_value }),
  settings: (i: string, p: unknown) => rpc('save_settings', { i, p }),
  platform: (action: string, p: unknown) => rpc<string>('platform_action', { action, p }),
  support: async () => {
    const { data, error } = await db()
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data as DataRow[];
  },
  metrics: () => rpc<DataRow[]>('platform_metrics'),
};
export const userService = {
  options: (i: string) => rpc<DataRow[]>('member_options', { i }),
  delegate: (i: string, u: string, r: string, scope_type: string, scope_id: string) =>
    rpc('assign_coordinator', { i, u, r, scope_type, scope_id }),
  profile: (p: unknown) => rpc('update_profile', { p }),
  list: (i: string, query_text = '') => rpc<DataRow[]>('institution_users', { i, query_text }),
  update: (i: string, u: string, p: unknown) => rpc('manage_member', { i, u, p }),
  invite: async (i: string, p: unknown) => {
    const { data, error } = await db().functions.invoke('invite-member', {
      body: { institution_id: i, ...(p as object) },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },
};
const directory = (kind: string) => ({
  save: (i: string, p: unknown, record_id?: string) =>
    rpc<string>('save_directory', { i, kind, p, record_id }),
});
export const departmentService = directory('departments');
export const clubService = {
  ...directory('clubs'),
  action: (club_id: string, action: string, member_id?: string) =>
    rpc('club_action', { club_id, action, member_id }),
};
export const venueService = {
  ...directory('venues'),
  resource: directory('resources').save,
  allocate: (event_id: string, resource_id: string, amount: number) =>
    rpc('allocate_resource', { event_id, resource_id, amount }),
};
export interface EventFilters {
  search?: string;
  eligible?: boolean;
  event_type?: string;
  category?: string;
  mode?: string;
  department_id?: string;
  club_id?: string;
  from?: string;
  to?: string;
  status?: string;
  is_team?: boolean;
  page?: number;
  managed?: boolean;
}
export const eventService = {
  get: (id: string) => one<CampusEvent>('events', id),
  list: async (i: string, f: EventFilters = {}) => {
    let q = db().from('events').select('*', { count: 'exact' }).eq('institution_id', i);
    if (f.search)
      q = q.textSearch('search_vector', f.search, { type: 'websearch', config: 'english' });
    for (const k of [
      'category',
      'mode',
      'department_id',
      'club_id',
      'status',
      'event_type',
    ] as const)
      if (f[k]) q = q.eq(k, f[k]);
    if (f.eligible) {
      const ids = await rpc<string[]>('eligible_event_ids', { i });
      q = q.in('id', ids);
    }
    if (f.is_team !== undefined) q = q.eq('is_team', f.is_team);
    if (f.from) q = q.gte('starts_at', f.from);
    if (f.to) q = q.lt('starts_at', f.to);
    if (!f.managed && !f.status)
      q = q.in('status', [
        'PUBLISHED',
        'REGISTRATION_OPEN',
        'REGISTRATION_CLOSED',
        'ONGOING',
        'COMPLETED',
      ]);
    const page = f.page || 0;
    const { data, count, error } = await q
      .order('starts_at', { ascending: true })
      .range(page * 12, page * 12 + 11);
    if (error) throw error;
    return { events: data as CampusEvent[], count: count || 0 };
  },
  save: (i: string, p: unknown, event_id?: string) => rpc<string>('save_event', { i, p, event_id }),
  transition: (event_id: string, target: string, reason = '') =>
    rpc<string>('transition_event', { event_id, target, reason }),
  reschedule: (
    event_id: string,
    new_start: string,
    new_end: string,
    new_deadline: string,
    reason: string,
  ) => rpc('reschedule_event', { event_id, new_start, new_end, new_deadline, reason }),
  saveBookmark: (event_id: string) => rpc<boolean>('toggle_saved', { event_id }),
};
export const approvalService = {
  review: eventService.transition,
  comment: (event_id: string, comment_text: string) =>
    rpc('review_comment', { event_id, comment_text }),
};
export const registrationService = {
  register: (
    event_id: string,
    answers: Record<string, string>,
    team_name?: string,
    team_code?: string,
  ) => rpc<Registration>('register_event', { event_id, answers, team_name, team_code }),
  action: (registration_id: string, action: string, reason = '') =>
    rpc<string>('registration_action', { registration_id, action, reason }),
  counts: (event_id: string) =>
    rpc<{ registered: number; confirmed: number; invited: number; checked_in: number }>(
      'event_counts',
      { event_id },
    ),
  participants: (event_id: string, query_text = '') =>
    rpc<DataRow[]>('participant_directory', { event_id, query_text }),
  promote: (event_id: string) => rpc<number>('process_waitlist', { event_id }),
};
export const ticketService = {
  issue: (registration_id: string) => rpc<string>('issue_ticket', { registration_id }),
};
export const attendanceService = {
  checkIn: (event_id: string, token?: string, registration_id?: string, reason?: string) =>
    rpc<{ status: string; name?: string; registration_number: string; checked_in_at: string }>(
      'check_in',
      { event_id, token, registration_id, reason },
    ),
  correct: (attendance_id: string, reason: string) =>
    rpc('correct_attendance', { attendance_id, reason }),
};
export const volunteerService = {
  apply: (event_id: string, p: unknown = {}) => rpc('volunteer_action', { event_id, p }),
  task: (event_id: string, p: unknown, task_id?: string) =>
    rpc<string>('save_task', { event_id, p, task_id }),
};
export const budgetService = {
  save: (event_id: string, p: unknown) => rpc<string>('save_budget', { event_id, p }),
  review: (entry_id: string, decision: string, reason: string) =>
    rpc('review_budget', { entry_id, decision, reason }),
};
export const certificateService = {
  issue: (event_id: string) => rpc<number>('issue_certificates', { event_id }),
  revoke: (certificate_id: string, reason: string) =>
    rpc('revoke_certificate', { certificate_id, reason }),
  verify: (code: string) =>
    rpc<{
      valid: boolean;
      recipient_name: string;
      event_title: string;
      institution: string;
      issued_at: string;
    } | null>('verify_certificate', { code }),
};
export const notificationService = {
  publish: (i: string, p: unknown) => rpc('publish_announcement', { i, p }),
  read: (notification_id: string) => rpc('read_notification', { notification_id }),
};
export const analyticsService = {
  get: (i: string, from_date: string, to_date: string) =>
    rpc<Analytics>('analytics', { i, from_date, to_date }),
};
export const reportService = {
  complete: (event_id: string, p: unknown) => rpc('completion_report', { event_id, p }),
  feedback: (event_id: string, rating_value: number, comment_text: string) =>
    rpc('submit_feedback', { event_id, rating_value, comment_text }),
  support: (i: string, subject_value: string, body_value: string) =>
    rpc('create_support', { i, subject_value, body_value }),
};
export const storageService = {
  branding: async (i: string, file: File, club_id?: string) => {
    if (file.size > 2097152 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      throw new Error('Use PNG, JPEG or WebP under 2 MB');
    const path = i + '/' + crypto.randomUUID() + '.' + file.name.split('.').pop();
    const { error } = await db()
      .storage.from('branding')
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    await rpc('set_branding', { i, path, club_id });
    return path;
  },
  upload: async (i: string, eventId: string, file: File, bucket = 'event-media') => {
    if (file.size > 10 * 1024 * 1024) throw new Error('Maximum file size is 10 MB');
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))
      throw new Error('Use JPEG, PNG, WebP or PDF');
    const path = `${i}/${eventId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const { error } = await db()
      .storage.from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },
  url: async (path: string, bucket = 'event-media') => {
    const { data, error } = await db().storage.from(bucket).createSignedUrl(path, 900);
    if (error) throw error;
    return data.signedUrl;
  },
};
export { rows };
