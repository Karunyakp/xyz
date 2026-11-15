import { db } from '../infrastructure/supabase';
import type { DataRow } from '../domain/models';
export type TableName =
  | 'academic_terms'
  | 'events'
  | 'registrations'
  | 'departments'
  | 'clubs'
  | 'club_memberships'
  | 'venues'
  | 'resources'
  | 'venue_bookings'
  | 'resource_allocations'
  | 'teams'
  | 'attendance'
  | 'saved_events'
  | 'volunteers'
  | 'tasks'
  | 'announcements'
  | 'notifications'
  | 'budget_entries'
  | 'feedback'
  | 'certificates'
  | 'completion_reports'
  | 'approvals'
  | 'workflow_history'
  | 'audit_logs'
  | 'invitations'
  | 'support_requests'
  | 'subscription_plans'
  | 'global_categories'
  | 'role_assignments';
export interface QueryOptions {
  eventId?: string;
  userId?: string;
  search?: string;
  searchColumn?: string;
  status?: string;
  order?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
}
export async function rows<T = DataRow>(
  table: TableName,
  institutionId: string,
  options: QueryOptions = {},
): Promise<T[]> {
  let q = db().from(table).select('*');
  if (!['subscription_plans', 'global_categories'].includes(table))
    q = q.eq('institution_id', institutionId);
  if (options.eventId) q = q.eq('event_id', options.eventId);
  if (options.userId) q = q.eq('user_id', options.userId);
  if (options.status) q = q.eq('status', options.status);
  if (options.search)
    q = q.ilike(
      options.searchColumn || 'title',
      '%' + options.search.replaceAll('%', '\\%').replaceAll('_', '\\_') + '%',
    );
  q = q.order(
    options.order ||
      ([
        'departments',
        'clubs',
        'venues',
        'resources',
        'subscription_plans',
        'global_categories',
      ].includes(table)
        ? 'name'
        : 'id'),
    { ascending: options.ascending ?? false },
  );
  const start = options.offset || 0;
  const { data, error } = await q.range(start, start + (options.limit || 500) - 1);
  if (error) throw new Error(error.message);
  return data as unknown as T[];
}
export async function one<T>(table: TableName, id: string): Promise<T> {
  const { data, error } = await db().from(table).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data as T;
}
