begin;
create function public.my_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column

begin if auth.uid() is null then raise exception 'Sign in required'; end if; return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where p.id=auth.uid()),'institutions',coalesce((select jsonb_agg(to_jsonb(i)) from public.institutions i where planora_private.is_member(i.id)),'[]'),'memberships',coalesce((select jsonb_agg(to_jsonb(m)) from public.memberships m where m.user_id=auth.uid() and planora_private.is_member(m.institution_id)),'[]'),'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.role_assignments a where a.user_id=auth.uid() and planora_private.is_member(a.institution_id)),'[]'),'role_permissions',(select jsonb_agg(to_jsonb(r)) from public.role_permissions r),'platform_admin',planora_private.is_platform_admin()); end $$;
create function public.update_profile(p jsonb) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 begin if auth.uid() is null then raise exception 'Sign in required'; end if; update public.profiles set full_name=left(p->>'full_name',120),bio=left(coalesce(p->>'bio',''),1000),interests=array(select jsonb_array_elements_text(coalesce(p->'interests','[]'))),skills=array(select jsonb_array_elements_text(coalesce(p->'skills','[]'))) where id=auth.uid(); end $$;

create function public.join_institution(slug_value text) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column

declare i public.institutions; mail text; begin
 select * into i from public.institutions where slug=slug_value and status='active'; select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if i.id is null or mail is null then raise exception 'Verified account and valid institution required'; end if;
 if not exists(select 1 from jsonb_array_elements_text(coalesce(i.settings->'allowed_domains','[]')) d where lower(d)=split_part(mail,'@',2)) then raise exception 'This institution requires an invitation or an approved institutional email domain'; end if;
 insert into public.memberships(institution_id,user_id) values(i.id,auth.uid()) on conflict(institution_id,user_id) do nothing;
 if not planora_private.is_member(i.id) then raise exception 'Membership is inactive; contact your administrator'; end if;
 insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(i.id,auth.uid(),'student','institution',i.id) on conflict do nothing;
 perform planora_private.log(i.id,'membership.join','membership',auth.uid()); return i.id;
end $$;
create function planora_private.validate_scope(i uuid,r text,st text,s uuid) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 begin
 if not exists(select 1 from public.roles where key=r and st=any(scopes)) then raise exception 'Invalid role scope'; end if;
 if (st='institution' and s<>i) or (st='department' and not exists(select 1 from public.departments where institution_id=i and id=s)) or (st='club' and not exists(select 1 from public.clubs where institution_id=i and id=s)) or (st='event' and not exists(select 1 from public.events where institution_id=i and id=s)) then raise exception 'Scope must belong to institution'; end if;
end $$;
create function public.create_invitation(i uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare n uuid; r text:=p->>'role'; st text:=coalesce(p->>'scope_type','institution'); s uuid:=coalesce(nullif(p->>'scope_id','')::uuid,i); begin
 if not planora_private.has_permission(i,'users.manage') then raise exception 'Permission denied'; end if;
 if r in ('owner','admin') and not exists(select 1 from public.role_assignments where institution_id=i and user_id=auth.uid() and role='owner') then raise exception 'Only an institution owner can appoint administrators'; end if;
 perform planora_private.validate_scope(i,r,st,s);
 if r='external' and not coalesce((select (settings->>'external_registration')::boolean from public.institutions where id=i),false) then raise exception 'External registrations are disabled'; end if;
 if (select count(*) from public.invitations where institution_id=i and invited_by=auth.uid() and created_at>now()-interval '1 hour')>=200 then raise exception 'Invitation limit reached; try again later'; end if;
 if lower(p->>'email') !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'Valid email required'; end if;
 insert into public.invitations(institution_id,email,role,scope_type,scope_id,department_id,invited_by) values(i,lower(p->>'email'),r,st,s,nullif(p->>'department_id','')::uuid,auth.uid()) returning id into n;
 perform planora_private.log(i,'invitation.create','invitation',n,jsonb_build_object('role',r)); return n;
end $$;
create function public.accept_invitations() returns int language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare v public.invitations; mail text; c int:=0; begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null; if mail is null then raise exception 'Verify your email first'; end if;
 for v in select * from public.invitations where lower(email)=mail and accepted_at is null and expires_at>now() for update loop
 if exists(select 1 from public.institutions where id=v.institution_id and status='active') then
 perform planora_private.validate_scope(v.institution_id,v.role,v.scope_type,v.scope_id);
 insert into public.memberships(institution_id,user_id,department_id,kind) values(v.institution_id,auth.uid(),v.department_id,case when v.role='external' then 'external' when v.role='student' then 'student' else 'staff' end) on conflict(institution_id,user_id) do nothing;
 if not planora_private.is_member(v.institution_id) then continue; end if;
 insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(v.institution_id,auth.uid(),v.role,v.scope_type,v.scope_id) on conflict do nothing;
 update public.invitations set accepted_at=now() where id=v.id; perform planora_private.log(v.institution_id,'invitation.accept','invitation',v.id); c:=c+1; end if; end loop; return c;
end $$;
create function public.manage_member(i uuid,u uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare r text:=p->>'role'; st text:=coalesce(p->>'scope_type','institution'); s uuid:=coalesce(nullif(p->>'scope_id','')::uuid,i); begin
 if not planora_private.has_permission(i,'users.manage') then raise exception 'Permission denied'; end if;
 if u=auth.uid() and p->>'status'='inactive' then raise exception 'You cannot deactivate yourself'; end if;
 if exists(select 1 from public.role_assignments where institution_id=i and user_id=u and role='owner') then raise exception 'Owner changes require a controlled ownership transfer'; end if;
 if r in ('owner','admin') and not exists(select 1 from public.role_assignments where institution_id=i and user_id=auth.uid() and role='owner') then raise exception 'Only the owner may appoint administrators'; end if;
 update public.memberships set status=coalesce(p->>'status',status),department_id=case when p ? 'department_id' then nullif(p->>'department_id','')::uuid else department_id end,student_number=coalesce(p->>'student_number',student_number),academic_year=coalesce(nullif(p->>'academic_year','')::int,academic_year) where institution_id=i and user_id=u;
 if r is not null then perform planora_private.validate_scope(i,r,st,s); if coalesce((p->>'revoke')::boolean,false) then delete from public.role_assignments where institution_id=i and user_id=u and role=r and scope_type=st and scope_id=s; else insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(i,u,r,st,s) on conflict do nothing; end if; end if;
 perform planora_private.log(i,'member.update','membership',u,p-'email');
end $$;

create function public.save_directory(i uuid,kind text,p jsonb,record_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare n uuid:=coalesce(record_id,gen_random_uuid()); begin
 if not planora_private.has_permission(i,'directory.manage') then raise exception 'Permission denied'; end if;
 if kind='departments' then insert into public.departments(id,institution_id,name,code,description) values(n,i,p->>'name',p->>'code',coalesce(p->>'description','')) on conflict(id) do update set name=excluded.name,code=excluded.code,description=excluded.description where departments.institution_id=i;
 elsif kind='clubs' then insert into public.clubs(id,institution_id,name,description,department_id,accepting_members) values(n,i,p->>'name',coalesce(p->>'description',''),nullif(p->>'department_id','')::uuid,coalesce((p->>'accepting_members')::boolean,true)) on conflict(id) do update set name=excluded.name,description=excluded.description,department_id=excluded.department_id,accepting_members=excluded.accepting_members where clubs.institution_id=i;
 elsif kind='venues' then insert into public.venues(id,institution_id,name,building,room,floor,capacity,equipment,restrictions,maintenance) values(n,i,p->>'name',coalesce(p->>'building',''),coalesce(p->>'room',''),coalesce(p->>'floor',''),(p->>'capacity')::int,array(select jsonb_array_elements_text(coalesce(p->'equipment','[]'))),coalesce(p->>'restrictions',''),coalesce((p->>'maintenance')::boolean,false)) on conflict(id) do update set name=excluded.name,building=excluded.building,room=excluded.room,floor=excluded.floor,capacity=excluded.capacity,equipment=excluded.equipment,restrictions=excluded.restrictions,maintenance=excluded.maintenance where venues.institution_id=i;
 elsif kind='resources' then insert into public.resources(id,institution_id,name,quantity,description) values(n,i,p->>'name',(p->>'quantity')::int,coalesce(p->>'description','')) on conflict(id) do update set name=excluded.name,quantity=excluded.quantity,description=excluded.description where resources.institution_id=i;
 else raise exception 'Unsupported directory'; end if;
 if not found then raise exception 'Record not found in institution'; end if; perform planora_private.log(i,'directory.save',kind,n); return n;
end $$;

create function public.save_event(i uuid,p jsonb,event_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; n uuid:=coalesce(event_id,gen_random_uuid()); dep uuid:=nullif(p->>'department_id','')::uuid; cl uuid:=nullif(p->>'club_id','')::uuid; begin
 if event_id is null then
 if not planora_private.has_permission(i,'event.create',coalesce(cl,dep,i)) then raise exception 'Permission denied'; end if;
 perform 1 from public.institutions where id=i for update;
 if not planora_private.feature_enabled(i,'events_enabled') then raise exception 'Event creation is disabled for this institution plan'; end if;
 if (select count(*) from public.events where institution_id=i and status not in ('COMPLETED','CANCELLED','REJECTED'))>=coalesce((select nullif(p.features->>'max_active_events','')::int from public.institutions t join public.subscription_plans p on p.name=t.plan where t.id=i),10000) then raise exception 'Active event allowance reached'; end if;
 else select * into e from public.events where id=event_id and institution_id=i for update; if e.id is null or not planora_private.has_permission(i,'event.manage',event_id) then raise exception 'Permission denied'; end if; if e.status not in ('DRAFT','REVISION_REQUESTED','REJECTED') then raise exception 'Return the event for revision before editing'; end if;
 -- Moving an event to a different scope requires authority there as well.
 if (dep is distinct from e.department_id or cl is distinct from e.club_id) and not planora_private.has_permission(i,'event.create',coalesce(cl,dep,i)) then raise exception 'No permission in destination scope'; end if;
 end if;
 if not exists(select 1 from pg_timezone_names where name=coalesce(p->>'timezone','Asia/Kolkata')) then raise exception 'Unknown timezone'; end if;
 if cl is not null and dep is not null and not exists(select 1 from public.clubs where id=cl and institution_id=i and (department_id=dep or department_id is null)) then raise exception 'Club and department do not match'; end if;
 if coalesce((p->>'allow_external')::boolean,false) and not coalesce((select (settings->>'external_registration')::boolean from public.institutions where id=i),false) then raise exception 'External registrations disabled by institution'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p->'questions','[]')) q where coalesce(q->>'id','')='' or coalesce(q->>'label','')='' or coalesce(q->>'type','text') not in ('text','textarea','select')) then raise exception 'Invalid registration questions'; end if;
 if (select count(*)<>count(distinct q->>'id') from jsonb_array_elements(coalesce(p->'questions','[]')) q) then raise exception 'Question IDs must be unique'; end if;
 if jsonb_array_length(coalesce(p->'questions','[]'))>30 then raise exception 'Maximum 30 registration questions'; end if;
 insert into public.events(id,institution_id,created_by,title,description,objectives,category,event_type,mode,starts_at,ends_at,registration_deadline,timezone,venue_id,online_url,capacity,waitlist_enabled,manual_approval,is_team,team_min,team_max,allow_external,eligible_departments,eligible_years,questions,agenda,faqs,rules,instructions,contact,cover_path,attachments,estimated_budget,department_id,club_id)
 values(n,i,auth.uid(),p->>'title',coalesce(p->>'description',''),coalesce(p->>'objectives',''),coalesce(p->>'category','Technical'),coalesce(p->>'event_type','Workshop'),coalesce(p->>'mode','offline'),(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,(p->>'registration_deadline')::timestamptz,coalesce(p->>'timezone','Asia/Kolkata'),nullif(p->>'venue_id','')::uuid,coalesce(p->>'online_url',''),(p->>'capacity')::int,coalesce((p->>'waitlist_enabled')::boolean,true),coalesce((p->>'manual_approval')::boolean,false),coalesce((p->>'is_team')::boolean,false),coalesce((p->>'team_min')::int,2),coalesce((p->>'team_max')::int,5),coalesce((p->>'allow_external')::boolean,false),array(select v::uuid from jsonb_array_elements_text(coalesce(p->'eligible_departments','[]')) v),array(select v::int from jsonb_array_elements_text(coalesce(p->'eligible_years','[]')) v),coalesce(p->'questions','[]'),coalesce(p->'agenda','[]'),coalesce(p->'faqs','[]'),coalesce(p->>'rules',''),coalesce(p->>'instructions',''),coalesce(p->>'contact',''),nullif(p->>'cover_path',''),coalesce(p->'attachments','[]'),coalesce((p->>'estimated_budget')::numeric,0),dep,cl)
 on conflict(id) do update set title=excluded.title,description=excluded.description,objectives=excluded.objectives,category=excluded.category,event_type=excluded.event_type,mode=excluded.mode,starts_at=excluded.starts_at,ends_at=excluded.ends_at,registration_deadline=excluded.registration_deadline,timezone=excluded.timezone,venue_id=excluded.venue_id,online_url=excluded.online_url,capacity=excluded.capacity,waitlist_enabled=excluded.waitlist_enabled,manual_approval=excluded.manual_approval,is_team=excluded.is_team,team_min=excluded.team_min,team_max=excluded.team_max,allow_external=excluded.allow_external,eligible_departments=excluded.eligible_departments,eligible_years=excluded.eligible_years,questions=excluded.questions,agenda=excluded.agenda,faqs=excluded.faqs,rules=excluded.rules,instructions=excluded.instructions,contact=excluded.contact,cover_path=excluded.cover_path,attachments=excluded.attachments,estimated_budget=excluded.estimated_budget,department_id=excluded.department_id,club_id=excluded.club_id,status='DRAFT',updated_at=clock_timestamp();
 if (select count(*) from public.registrations where registrations.event_id=n and status in ('confirmed','invited'))>(p->>'capacity')::int then raise exception 'Capacity cannot be below reserved seats'; end if;
 if event_id is null then insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(i,auth.uid(),'organiser','event',n); end if;
 perform planora_private.log(i,'event.save','event',n); return n;
end $$;

create function planora_private.book_venue(e public.events) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare v public.venues; begin
 if e.venue_id is null then if e.mode='offline' then raise exception 'Offline events need a venue'; end if; return; end if;
 select * into v from public.venues where id=e.venue_id and institution_id=e.institution_id for update;
 if v.id is null or v.maintenance then raise exception 'Venue unavailable'; end if;
 if e.capacity>v.capacity then raise exception 'Event capacity exceeds venue capacity'; end if;
 if exists(select 1 from public.venue_bookings b where b.venue_id=v.id and b.event_id<>e.id and b.status='confirmed' and b.starts_at<e.ends_at and b.ends_at>e.starts_at) then raise exception 'Venue conflict: another confirmed event overlaps'; end if;
 insert into public.venue_bookings(institution_id,event_id,venue_id,starts_at,ends_at,status) values(e.institution_id,e.id,e.venue_id,e.starts_at,e.ends_at,'confirmed') on conflict(event_id) do update set venue_id=excluded.venue_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='confirmed';
end $$;
create function public.transition_event(event_id uuid,target text,reason text default '') returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; allowed boolean:=false; required_count int; n int; prior text; begin
 select * into e from public.events where id=event_id for update; if e.id is null then raise exception 'Event not found'; end if; prior:=e.status;
 if target in ('APPROVED','REJECTED','REVISION_REQUESTED') and e.status='PENDING_APPROVAL' then
 if not planora_private.has_permission(e.institution_id,'event.approve',e.id) then raise exception 'Approval permission required'; end if;
 if e.created_by=auth.uid() then raise exception 'An independent reviewer must approve this proposal'; end if;
 if target in ('REJECTED','REVISION_REQUESTED') and length(trim(reason))<3 then raise exception 'A review reason is required'; end if;
 if exists(select 1 from public.approvals where approvals.event_id=e.id and reviewer_id=auth.uid() and version=e.updated_at and decision='APPROVED') and target='APPROVED' then raise exception 'You have already approved this version'; end if;
 insert into public.approvals(institution_id,event_id,reviewer_id,decision,comments,version) values(e.institution_id,e.id,auth.uid(),target,reason,e.updated_at);
 required_count:=greatest(1,coalesce((select (settings->>'approval_count')::int from public.institutions where id=e.institution_id),1));
 if target='APPROVED' then select count(distinct reviewer_id) into n from public.approvals where approvals.event_id=e.id and decision='APPROVED' and version=e.updated_at; if n<required_count then perform planora_private.notify(e.institution_id,e.created_by,'Review received',n||' of '||required_count||' approvals received.','/events/'||e.id); return 'PENDING_APPROVAL'; end if; perform planora_private.book_venue(e); end if;
 allowed:=true;
 else
 if not planora_private.has_permission(e.institution_id,'event.manage',e.id) then raise exception 'Event management permission required'; end if;
 allowed:=case e.status
 when 'DRAFT' then target='PENDING_APPROVAL'
 when 'REVISION_REQUESTED' then target='PENDING_APPROVAL'
 when 'REJECTED' then target='PENDING_APPROVAL'
 when 'APPROVED' then target='PUBLISHED'
 when 'PUBLISHED' then target='REGISTRATION_OPEN'
 when 'REGISTRATION_OPEN' then target='REGISTRATION_CLOSED'
 when 'REGISTRATION_CLOSED' then target in ('ONGOING','REGISTRATION_OPEN')
 when 'ONGOING' then target='COMPLETED' else false end;
 if target='CANCELLED' and e.status not in ('COMPLETED','CANCELLED') and length(trim(reason))>=3 then allowed:=true; end if;
 if target='PENDING_APPROVAL' then
 if length(trim(e.description))<20 or e.starts_at<=now() or e.registration_deadline<=now() then raise exception 'Complete the description and use future event / registration dates'; end if;
 if not coalesce((select (settings->>'approval_required')::boolean from public.institutions where id=e.institution_id),true) then target:='APPROVED'; perform planora_private.book_venue(e); end if;
 end if;
 if target='ONGOING' and now()<e.starts_at-interval '2 hours' then raise exception 'Check-in can open two hours before start'; end if;
 if target='COMPLETED' and now()<e.starts_at then raise exception 'Cannot complete an event before its start'; end if;
 if target='REGISTRATION_OPEN' and e.registration_deadline<=now() then raise exception 'Registration deadline has passed'; end if;
 end if;
 if not allowed then raise exception 'Invalid lifecycle transition: % to %',e.status,target; end if;
 update public.events set status=target where id=e.id;
 if target='CANCELLED' then update public.venue_bookings set status='cancelled' where venue_bookings.event_id=e.id; update public.registrations set status='cancelled',updated_at=now() where registrations.event_id=e.id and status not in ('rejected','expired','cancelled'); end if;
 insert into public.workflow_history(institution_id,event_id,previous_status,new_status,actor_id,reason) values(e.institution_id,e.id,prior,target,auth.uid(),reason);
 perform planora_private.log(e.institution_id,'event.transition','event',e.id,jsonb_build_object('from',prior,'to',target,'reason',reason));
 perform planora_private.notify(e.institution_id,e.created_by,'Event status updated',e.title||' · '||replace(target,'_',' '),'/events/'||e.id);
 if target='CANCELLED' then insert into public.notifications(institution_id,user_id,title,body,link) select e.institution_id,r.user_id,'Event cancelled',e.title||': '||reason,'/events/'||e.id from public.registrations r where r.event_id=e.id; end if;
 return target;
end $$;
create function public.review_comment(event_id uuid,comment_text text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin select * into e from public.events where id=event_id; if not planora_private.has_permission(e.institution_id,'event.approve',e.id) then raise exception 'Permission denied'; end if; insert into public.approvals(institution_id,event_id,reviewer_id,decision,comments,version) values(e.institution_id,e.id,auth.uid(),'COMMENT',comment_text,e.updated_at); end $$;
create function public.reschedule_event(event_id uuid,new_start timestamptz,new_end timestamptz,new_deadline timestamptz,reason text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin
 select * into e from public.events where id=event_id for update;
 if not planora_private.has_permission(e.institution_id,'event.manage',e.id) or e.status in ('COMPLETED','CANCELLED','ONGOING') then raise exception 'Rescheduling not permitted'; end if;
 if length(trim(reason))<3 or new_start<=now() then raise exception 'Provide a reason and future dates'; end if;
 update public.events set starts_at=new_start,ends_at=new_end,registration_deadline=new_deadline,status='DRAFT',updated_at=clock_timestamp() where id=e.id;
 update public.venue_bookings set status='cancelled' where venue_bookings.event_id=e.id;
 insert into public.workflow_history(institution_id,event_id,previous_status,new_status,actor_id,reason) values(e.institution_id,e.id,e.status,'DRAFT',auth.uid(),reason);
 insert into public.notifications(institution_id,user_id,title,body,link) select e.institution_id,r.user_id,'Event rescheduled — awaiting review',e.title||': '||reason,'/events/'||e.id from public.registrations r where r.event_id=e.id;
 perform planora_private.log(e.institution_id,'event.reschedule','event',e.id,jsonb_build_object('reason',reason));
end $$;

create function planora_private.eligible(e public.events,u uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.memberships m join auth.users a on a.id=m.user_id where m.institution_id=e.institution_id and m.user_id=u and m.status='active' and a.email_confirmed_at is not null and (m.kind<>'external' or (e.allow_external and coalesce((select (settings->>'external_registration')::boolean from public.institutions where id=e.institution_id),false))) and (cardinality(e.eligible_departments)=0 or m.department_id=any(e.eligible_departments)) and (cardinality(e.eligible_years)=0 or m.academic_year=any(e.eligible_years))) $$;
create function planora_private.promote_waitlist(event_id uuid) returns int language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; r public.registrations; seats int; promoted int:=0; hrs int; begin
 select * into e from public.events where id=event_id for update;
 update public.registrations set status='expired',updated_at=now() where registrations.event_id=e.id and status='invited' and invitation_expires_at<=now();
 if e.status<>'REGISTRATION_OPEN' or now()>=e.registration_deadline then return 0; end if;
 select e.capacity-count(*) into seats from public.registrations where registrations.event_id=e.id and status in ('confirmed','invited');
 hrs:=greatest(1,least(168,coalesce((select (settings->>'waitlist_hours')::int from public.institutions where id=e.institution_id),24)));
 for r in select * from public.registrations where registrations.event_id=e.id and status='waitlisted' order by created_at,id for update loop
 exit when seats<=0;
 if not planora_private.eligible(e,r.user_id) then update public.registrations set status='rejected',updated_at=now() where id=r.id; continue; end if;
 update public.registrations set status='invited',invitation_expires_at=least(e.registration_deadline,now()+make_interval(hours=>hrs)),updated_at=now() where id=r.id;
 perform planora_private.notify(e.institution_id,r.user_id,'A seat is waiting for you',e.title||' — accept before the invitation expires.','/my-events'); seats:=seats-1; promoted:=promoted+1; end loop;
 return promoted;
end $$;
create function public.register_event(event_id uuid,answers jsonb default '{}',team_name text default null,team_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; r public.registrations; t public.teams; state text; used int; q jsonb; begin
 select * into e from public.events where id=event_id for update;
 if e.id is null or not planora_private.is_member(e.institution_id) or not planora_private.eligible(e,auth.uid()) then raise exception 'You do not meet this event’s eligibility requirements'; end if;
 if not planora_private.feature_enabled(e.institution_id,'registration_enabled') then raise exception 'Registrations are disabled for this institution plan'; end if;
 if e.status<>'REGISTRATION_OPEN' or now()>=e.registration_deadline then raise exception 'Registration is closed'; end if;
 if exists(select 1 from public.registrations where registrations.event_id=e.id and user_id=auth.uid()) then raise exception 'You already have a registration for this event'; end if;
 for q in select * from jsonb_array_elements(e.questions) loop
 if coalesce((q->>'required')::boolean,false) and length(trim(coalesce(answers->>(q->>'id'),'')))=0 then raise exception 'Required answer missing: %',q->>'label'; end if;
 if q->>'type'='select' and answers ? (q->>'id') and not exists(select 1 from jsonb_array_elements_text(coalesce(q->'options','[]')) v where v=answers->>(q->>'id')) then raise exception 'Invalid option: %',q->>'label'; end if;
 end loop;
 if octet_length(answers::text)>20000 then raise exception 'Answers are too large'; end if;
 if e.is_team then
 if nullif(trim(team_code),'') is not null then select * into t from public.teams where join_code=trim(team_code) and teams.event_id=e.id;
 if t.id is null then raise exception 'Team code not found'; end if;
 if (select count(*) from public.registrations where team_id=t.id and status not in ('cancelled','rejected','expired'))>=e.team_max then raise exception 'Team is full'; end if;
 else if length(trim(coalesce(team_name,'')))<2 then raise exception 'Create a team name or enter a team code'; end if;
 insert into public.teams(institution_id,event_id,name,leader_id) values(e.institution_id,e.id,trim(team_name),auth.uid()) returning * into t; end if;
 end if;
 perform planora_private.promote_waitlist(e.id);
 select count(*) into used from public.registrations where registrations.event_id=e.id and status in ('confirmed','invited');
 if e.manual_approval then state:='pending'; elsif used<e.capacity then state:='confirmed'; elsif e.waitlist_enabled then state:='waitlisted'; else raise exception 'This event is full'; end if;
 insert into public.registrations(institution_id,event_id,user_id,team_id,status,answers) values(e.institution_id,e.id,auth.uid(),t.id,state,answers) returning * into r;
 perform planora_private.notify(e.institution_id,auth.uid(),'Registration '||state,e.title,'/my-events'); perform planora_private.log(e.institution_id,'registration.create','registration',r.id,jsonb_build_object('status',state)); return to_jsonb(r);
end $$;
create function public.registration_action(registration_id uuid,action text,reason text default '') returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare r public.registrations; e public.events; n int; begin
 select * into r from public.registrations where id=registration_id; select * into e from public.events where id=r.event_id for update; select * into r from public.registrations where id=registration_id for update;
 if r.id is null or not planora_private.is_member(e.institution_id) then raise exception 'Registration unavailable'; end if;
 if e.status in ('COMPLETED','CANCELLED') then raise exception 'Event is closed'; end if;
 if action='cancel' then
 if r.user_id<>auth.uid() and not planora_private.has_permission(e.institution_id,'registration.manage',e.id) then raise exception 'Permission denied'; end if;
 if exists(select 1 from public.attendance where attendance.registration_id=r.id) then raise exception 'Checked-in registrations cannot be cancelled'; end if;
 update public.registrations set status='cancelled',updated_at=now() where id=r.id;
 elsif action='accept' then
 if e.status<>'REGISTRATION_OPEN' or now()>=e.registration_deadline then raise exception 'Registration is closed'; end if;
 if r.user_id<>auth.uid() or r.status<>'invited' or r.invitation_expires_at<=now() or not planora_private.eligible(e,auth.uid()) then raise exception 'Invitation unavailable or expired'; end if;
 update public.registrations set status='confirmed',invitation_expires_at=null,updated_at=now() where id=r.id;
 elsif action in ('approve','reject') then
 if action='approve' and (e.status<>'REGISTRATION_OPEN' or now()>=e.registration_deadline) then raise exception 'Registration is closed'; end if;
 if not planora_private.has_permission(e.institution_id,'registration.manage',e.id) then raise exception 'Permission denied'; end if;
 if r.status<>'pending' then raise exception 'Only pending applications can be reviewed'; end if;
 if action='reject' then if length(trim(reason))<3 then raise exception 'Reason required'; end if; update public.registrations set status='rejected',updated_at=now() where id=r.id;
 else if not planora_private.eligible(e,r.user_id) then raise exception 'Participant no longer eligible'; end if;
 perform planora_private.promote_waitlist(e.id); select count(*) into n from public.registrations where event_id=e.id and status in ('confirmed','invited');
 if n>=e.capacity and not e.waitlist_enabled then raise exception 'No seats available'; end if;
 update public.registrations set status=case when n<e.capacity then 'confirmed' else 'waitlisted' end,updated_at=now() where id=r.id; end if;
 else raise exception 'Invalid action'; end if;
 perform planora_private.promote_waitlist(e.id); perform planora_private.log(e.institution_id,'registration.'||action,'registration',r.id,jsonb_build_object('reason',reason));
 perform planora_private.notify(e.institution_id,r.user_id,'Registration updated',e.title||': '||action,'/my-events'); return (select status from public.registrations where id=r.id);
end $$;
create function public.process_waitlist(event_id uuid) returns int language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin select * into e from public.events where id=event_id; if not planora_private.has_permission(e.institution_id,'registration.manage',e.id) then raise exception 'Permission denied'; end if; return planora_private.promote_waitlist(event_id); end $$;
create function public.issue_ticket(registration_id uuid) returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare r public.registrations; token text; begin
 select * into r from public.registrations where id=registration_id for update;
 if r.user_id<>auth.uid() or not planora_private.is_member(r.institution_id) or r.status<>'confirmed' then raise exception 'Confirmed registration required'; end if;
 if exists(select 1 from public.attendance where attendance.registration_id=r.id) then raise exception 'Already checked in'; end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into planora_private.ticket_secrets(registration_id,token_hash) values(r.id,encode(sha256(convert_to(token,'UTF8')),'hex')) on conflict(registration_id) do update set token_hash=excluded.token_hash,issued_at=now();
 return 'PLANORA:'||token;
end $$;
create function public.check_in(event_id uuid,token text default null,registration_id uuid default null,reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; r public.registrations; a public.attendance; begin
 select * into e from public.events where id=event_id;
 if e.id is null or not planora_private.has_permission(e.institution_id,'attendance.scan',e.id) then raise exception 'You cannot scan for this event'; end if;
 if e.status<>'ONGOING' then raise exception 'Check-in is available only while the event is ongoing'; end if;
 if token is not null then select x.* into r from public.registrations x join planora_private.ticket_secrets t on t.registration_id=x.id where t.token_hash=encode(sha256(convert_to(replace(token,'PLANORA:',''),'UTF8')),'hex') for update of x;
 else if not planora_private.has_permission(e.institution_id,'registration.manage',e.id) or length(trim(reason))<3 then raise exception 'Manual check-in requires organiser permission and a reason'; end if; select * into r from public.registrations where id=registration_id for update; end if;
 if r.id is null or r.event_id<>e.id or r.status<>'confirmed' then raise exception 'Invalid ticket for this event'; end if;
 select * into a from public.attendance where attendance.registration_id=r.id; if a.id is not null then return jsonb_build_object('status','already_checked_in','checked_in_at',a.checked_in_at,'registration_number',r.registration_number); end if;
 if e.is_team and (select count(*) from public.registrations where team_id=r.team_id and status='confirmed')<e.team_min then raise exception 'Team needs more confirmed members before check-in'; end if;
 insert into public.attendance(institution_id,event_id,registration_id,user_id,checked_in_by,method,note) values(e.institution_id,e.id,r.id,r.user_id,auth.uid(),case when token is null then 'manual' else 'qr' end,reason) returning * into a;
 perform planora_private.log(e.institution_id,'attendance.check_in','attendance',a.id,jsonb_build_object('method',a.method)); return jsonb_build_object('status','checked_in','checked_in_at',a.checked_in_at,'registration_number',r.registration_number,'name',(select full_name from public.profiles where id=r.user_id));
end $$;
create function public.correct_attendance(attendance_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare a public.attendance; begin select * into a from public.attendance where id=attendance_id for update; if not planora_private.has_permission(a.institution_id,'event.approve',a.event_id) or length(trim(reason))<5 then raise exception 'Faculty permission and correction reason required'; end if; if exists(select 1 from public.certificates where registration_id=a.registration_id and revoked_at is null) then raise exception 'Revoke the certificate before correcting attendance'; end if; delete from public.attendance where id=a.id; perform planora_private.log(a.institution_id,'attendance.correct','attendance',a.id,jsonb_build_object('reason',reason,'original',to_jsonb(a))); end $$;
do $$ declare f record; begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['my_context','update_profile','join_institution','create_invitation','accept_invitations','manage_member','save_directory','save_event','transition_event','review_comment','reschedule_event','register_event','registration_action','process_waitlist','issue_ticket','check_in','correct_attendance']) loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature); end loop; end $$;
commit;
