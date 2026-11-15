begin;
create or replace function planora_private.can_view_event(i uuid,e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select planora_private.is_member(i) and exists(select 1 from public.events x where x.id=e and x.institution_id=i and (
 (x.status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING','COMPLETED') and (x.allow_external or not exists(select 1 from public.memberships m where m.institution_id=i and m.user_id=auth.uid() and m.kind='external')))
 or planora_private.has_permission(i,'event.manage',e) or planora_private.has_permission(i,'event.approve',e) or planora_private.has_permission(i,'attendance.scan',e)
 or exists(select 1 from public.registrations r where r.event_id=e and r.user_id=auth.uid())))
$$;
drop policy announcement_read on public.announcements;
create policy announcement_read on public.announcements for select to authenticated using(planora_private.is_member(institution_id) and ((event_id is not null and planora_private.can_view_event(institution_id,event_id)) or (event_id is null and not exists(select 1 from public.memberships m where m.institution_id=announcements.institution_id and m.user_id=auth.uid() and m.kind='external'))));
-- Deferred consistency checks defend against operational bugs in addition to RPC validation.
create function planora_private.registration_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.team_id is not null and not exists(select 1 from public.teams t where t.id=new.team_id and t.event_id=new.event_id and t.institution_id=new.institution_id) then raise exception 'Team must belong to registration event'; end if;
 return new;
end $$;
create trigger registration_integrity before insert or update on public.registrations for each row execute function planora_private.registration_integrity();
create function public.event_counts(event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.events; begin select * into e from public.events where id=event_id;
 if not(planora_private.has_permission(e.institution_id,'report.read',e.id) or planora_private.has_permission(e.institution_id,'attendance.scan',e.id)) then raise exception 'Permission denied'; end if;
 return jsonb_build_object('registered',(select count(*) from public.registrations r where r.event_id=e.id),'confirmed',(select count(*) from public.registrations r where r.event_id=e.id and status='confirmed'),'invited',(select count(*) from public.registrations r where r.event_id=e.id and status='invited'),'checked_in',(select count(*) from public.attendance a where a.event_id=e.id));
end $$;
create function public.coordinators(i uuid,c uuid) returns table(name text,role text) language plpgsql stable security definer set search_path='' as $$ begin
 if not planora_private.is_member(i) or not exists(select 1 from public.clubs where id=c and institution_id=i) or exists(select 1 from public.memberships where institution_id=i and user_id=auth.uid() and kind='external') then raise exception 'Permission denied'; end if;
 return query select p.full_name,a.role from public.role_assignments a join public.profiles p on p.id=a.user_id where a.institution_id=i and a.scope_type='club' and a.scope_id=c and a.role in ('faculty','club_admin');
end $$;
revoke execute on function public.event_counts(uuid),public.coordinators(uuid,uuid) from public,anon;
grant execute on function public.event_counts(uuid),public.coordinators(uuid,uuid) to authenticated;
revoke execute on function planora_private.registration_integrity() from public,anon,authenticated;
commit;
