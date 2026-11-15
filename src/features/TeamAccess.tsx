import { useQuery } from '@tanstack/react-query';
import { useApp } from '../app/context';
import { useRows, useAction } from '../app/hooks';
import { userService } from '../services';
import { PageHeader, Card, SmartForm } from '../components/ui';
import type { CampusEvent } from '../domain/models';
export function TeamAccess() {
  const { institutionId, can } = useApp();
  const members = useQuery({
    queryKey: ['member-options', institutionId],
    queryFn: () => userService.options(institutionId),
  });
  const departments = useRows('departments'),
    clubs = useRows('clubs'),
    events = useRows<CampusEvent>('events');
  const action = useAction();
  const scopes = [
    ...(departments.data || [])
      .filter((d) => can('event.manage', d.id))
      .map((d) => ({ value: 'department:' + d.id, label: 'Department · ' + d.name })),
    ...(clubs.data || [])
      .filter((c) => can('event.manage', c.id))
      .map((c) => ({ value: 'club:' + c.id, label: 'Club · ' + c.name })),
    ...(events.data || [])
      .filter((e) => can('event.manage', e))
      .map((e) => ({ value: 'event:' + e.id, label: 'Event · ' + e.title })),
  ];
  return (
    <>
      <PageHeader
        eyebrow="SHARED RESPONSIBILITY"
        title="Build the team behind the experience."
        description="Assign event organisers and volunteers within your scope. HODs can appoint department coordinators and reviewers."
      />
      <Card>
        <SmartForm
          fields={[
            {
              name: 'user_id',
              label: 'Institution member',
              type: 'select',
              required: true,
              options: members.data?.map((m) => ({
                value: String(m.user_id),
                label: String(m.name),
              })),
            },
            {
              name: 'scope',
              label: 'Responsibility scope',
              type: 'select',
              required: true,
              options: scopes,
            },
            {
              name: 'role',
              label: 'Role',
              type: 'select',
              required: true,
              options: [
                { value: 'organiser', label: 'Event organiser' },
                { value: 'volunteer', label: 'Check-in volunteer (event only)' },
                { value: 'faculty', label: 'Faculty reviewer (HOD / administrator only)' },
                { value: 'club_admin', label: 'Club coordinator (HOD / administrator only)' },
              ],
            },
          ]}
          onSubmit={async (p) => {
            const [scope_type, scope_id] = String(p.scope).split(':');
            await userService.delegate(
              institutionId,
              String(p.user_id),
              String(p.role),
              scope_type,
              scope_id,
            );
            await action.run(async () => undefined, 'Responsibility assigned');
          }}
        />
      </Card>
    </>
  );
}
