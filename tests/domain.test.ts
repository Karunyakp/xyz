import { describe, it, expect } from 'vitest';
import { can, csvCell, safeUrl, type UserContext, type CampusEvent } from '../src/domain/models';
import { eventSchema, signUpSchema } from '../src/domain/validation';
const context = {
  assignments: [
    {
      institution_id: 'a',
      user_id: 'u',
      role: 'volunteer',
      scope_type: 'event',
      scope_id: 'event-a',
    },
  ],
  role_permissions: [{ role: 'volunteer', permission: 'attendance.scan' }],
} as UserContext;
describe('Scoped access', () => {
  it('rejects the wrong tenant', () => expect(can(context, 'b', 'attendance.scan')).toBe(false));
  it('permits assigned event only', () => {
    expect(can(context, 'a', 'attendance.scan', 'event-a')).toBe(true);
    expect(can(context, 'a', 'attendance.scan', 'event-b')).toBe(false);
  });
  it('does not turn check-in access into admin access', () =>
    expect(can(context, 'a', 'users.manage')).toBe(false));
  it('recognises department-scoped event authority', () => {
    const c = {
      ...context,
      assignments: [{ ...context.assignments[0], scope_type: 'department', scope_id: 'd' }],
    };
    expect(
      can(c, 'a', 'attendance.scan', { id: 'e', department_id: 'd', club_id: null } as CampusEvent),
    ).toBe(true);
  });
});
describe('Input boundaries', () => {
  it('rejects unsafe URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('https://example.edu/event')).toBe('https://example.edu/event');
  });
  it('neutralises CSV formula injection and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('hello, world')).toBe('"hello, world"');
    expect(csvCell('  +SUM(A1)')).toBe('"\'  +SUM(A1)"');
  });
  it('requires strong signup passwords', () =>
    expect(
      signUpSchema.safeParse({ email: 'a@b.com', password: 'short', full_name: 'Student' }).success,
    ).toBe(false));
  it('rejects reverse time ranges', () =>
    expect(
      eventSchema.safeParse({
        title: 'Event',
        description: 'Long enough description here',
        category: 'Technical',
        event_type: 'Workshop',
        starts_at: '2027-01-01T10:00:00Z',
        ends_at: '2027-01-01T09:00:00Z',
        registration_deadline: '2027-01-01T08:00:00Z',
        capacity: 10,
        mode: 'online',
        timezone: 'Asia/Kolkata',
      }).success,
    ).toBe(false));
});
