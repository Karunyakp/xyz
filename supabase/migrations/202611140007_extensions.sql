begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('branding','branding',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy planora_branding_read on storage.objects for select to authenticated using(bucket_id='branding' and planora_private.is_member(planora_private.storage_institution(name)));
create policy planora_branding_insert on storage.objects for insert to authenticated with check(bucket_id='branding' and planora_private.has_permission(planora_private.storage_institution(name),'directory.manage'));
create function public.set_branding(i uuid,path text,club_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not planora_private.has_permission(i,'directory.manage') or planora_private.storage_institution(path) is distinct from i or not exists(select 1 from storage.objects where bucket_id='branding' and name=path) then raise exception 'Authorised uploaded institution image required'; end if;
 if club_id is null then update public.institutions set logo_path=path where id=i; else update public.clubs set logo_path=path where id=club_id and institution_id=i; end if;
 perform planora_private.log(i,'branding.update',case when club_id is null then 'institution' else 'club' end,coalesce(club_id,i));
end $$;
create function public.assign_coordinator(i uuid,u uuid,r text,scope_type text,scope_id uuid) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable

begin
 perform planora_private.validate_scope(i,r,scope_type,scope_id);
 if scope_type='institution' or r in ('admin','owner','hod','student','external') then raise exception 'Use institution administration for this role'; end if;
 if not planora_private.has_permission(i,'event.manage',scope_id) then raise exception 'Cannot assign responsibility outside your managed scope'; end if;
 if r in ('faculty','club_admin') and not(planora_private.has_permission(i,'users.manage') or exists(select 1 from public.role_assignments a where a.institution_id=i and a.user_id=auth.uid() and a.role='hod' and ((scope_type='department' and a.scope_id=scope_id) or exists(select 1 from public.events e where e.id=scope_id and e.department_id=a.scope_id) or exists(select 1 from public.clubs c where c.id=scope_id and c.department_id=a.scope_id)))) then raise exception 'Only institution administrators and the relevant HOD can appoint coordinators or reviewers'; end if;
 if r not in ('faculty','club_admin','organiser','volunteer') then raise exception 'Role cannot be delegated'; end if;
 if not exists(select 1 from public.memberships where institution_id=i and user_id=u and status='active' and kind<>'external') then raise exception 'Select an active internal institution member'; end if;
 insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(i,u,r,scope_type,scope_id) on conflict do nothing;
 perform planora_private.log(i,'role.delegate','membership',u,jsonb_build_object('role',r,'scope_type',scope_type,'scope_id',scope_id));
end $$;
create function public.member_options(i uuid) returns table(user_id uuid,name text) language plpgsql stable security definer set search_path='' as $$ begin
 if not planora_private.is_member(i) or not exists(select 1 from public.role_assignments a join public.role_permissions p on p.role=a.role where a.institution_id=i and a.user_id=auth.uid() and p.permission in ('event.manage','users.manage')) then raise exception 'Permission denied'; end if;
 return query select m.user_id,p.full_name from public.memberships m join public.profiles p on p.id=m.user_id where m.institution_id=i and m.status='active' and m.kind<>'external' order by p.full_name limit 10000;
end $$;
create function public.eligible_event_ids(i uuid) returns uuid[] language sql stable security definer set search_path='' as $$ select coalesce(array_agg(e.id),'{}') from public.events e where e.institution_id=i and planora_private.can_view_event(i,e.id) and planora_private.eligible(e,auth.uid()) $$;
-- Reserve requested venue metadata at submission; final approval still takes the venue lock.
create function planora_private.track_booking_request() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.status='PENDING_APPROVAL' and new.venue_id is not null then insert into public.venue_bookings(institution_id,event_id,venue_id,starts_at,ends_at,status) values(new.institution_id,new.id,new.venue_id,new.starts_at,new.ends_at,'requested') on conflict(event_id) do update set venue_id=excluded.venue_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='requested'; end if;
 if new.status in ('REJECTED','REVISION_REQUESTED') then update public.venue_bookings set status='cancelled' where event_id=new.id; end if;
 return new;
end $$;
create trigger booking_requests after update of status on public.events for each row execute function planora_private.track_booking_request();
-- Revalidate previously allocated inventory before moving a draft back into an approved schedule.
create function planora_private.validate_event_resources() returns trigger language plpgsql security definer set search_path='' as $$ declare a record; used int; available int; begin
 if new.status='APPROVED' then
 for a in select * from public.resource_allocations where event_id=new.id order by resource_id loop
 select quantity into available from public.resources where id=a.resource_id for update;
 select coalesce(sum(x.quantity),0) into used from public.resource_allocations x join public.events e on e.id=x.event_id where x.resource_id=a.resource_id and e.id<>new.id and e.status not in ('COMPLETED','CANCELLED','REJECTED') and e.starts_at<new.ends_at and e.ends_at>new.starts_at;
 if used+a.quantity>available then raise exception 'Resource conflict after scheduling change'; end if;
 end loop; end if; return new;
end $$;
create trigger event_resources before update of status on public.events for each row execute function planora_private.validate_event_resources();
revoke execute on function public.set_branding(uuid,text,uuid),public.assign_coordinator(uuid,uuid,text,text,uuid),public.member_options(uuid),public.eligible_event_ids(uuid) from public,anon;
grant execute on function public.set_branding(uuid,text,uuid),public.assign_coordinator(uuid,uuid,text,text,uuid),public.member_options(uuid),public.eligible_event_ids(uuid) to authenticated;
revoke execute on function planora_private.track_booking_request(),planora_private.validate_event_resources() from public,anon,authenticated;
commit;
