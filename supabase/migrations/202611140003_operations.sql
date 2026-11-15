begin;
create function public.toggle_saved(event_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin select * into e from public.events where id=event_id; if not planora_private.can_view_event(e.institution_id,e.id) then raise exception 'Event unavailable'; end if; delete from public.saved_events where saved_events.event_id=e.id and user_id=auth.uid(); if found then return false; end if; insert into public.saved_events values(e.institution_id,e.id,auth.uid()); return true; end $$;
create function public.club_action(club_id uuid,action text,member_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare c public.clubs; begin select * into c from public.clubs where id=club_id;
 if not planora_private.is_member(c.institution_id) or exists(select 1 from public.memberships where institution_id=c.institution_id and user_id=auth.uid() and kind='external') then raise exception 'Permission denied'; end if;
 if action in ('following','applied') then if action='applied' and not c.accepting_members then raise exception 'Membership applications closed'; end if;
 insert into public.club_memberships(institution_id,club_id,user_id,status) values(c.institution_id,c.id,auth.uid(),action) on conflict(club_id,user_id) do update set status=excluded.status where club_memberships.status<>'accepted';
 elsif action='unfollow' then delete from public.club_memberships where club_memberships.club_id=c.id and user_id=auth.uid();
 elsif action in ('accepted','rejected') and planora_private.has_permission(c.institution_id,'event.manage',c.id) then update public.club_memberships set status=action where id=member_id and club_memberships.club_id=c.id;
 else raise exception 'Invalid action or permission'; end if; perform planora_private.log(c.institution_id,'club.'||action,'club',c.id);
end $$;
create function public.save_task(event_id uuid,p jsonb,task_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; t public.tasks; n uuid:=coalesce(task_id,gen_random_uuid()); begin
 select * into e from public.events where id=event_id;
 if planora_private.has_permission(e.institution_id,'event.manage',e.id) then
 insert into public.tasks(id,institution_id,event_id,title,assigned_to,due_at,status,notes) values(n,e.institution_id,e.id,p->>'title',nullif(p->>'assigned_to','')::uuid,nullif(p->>'due_at','')::timestamptz,coalesce(p->>'status','todo'),coalesce(p->>'notes','')) on conflict(id) do update set title=excluded.title,assigned_to=excluded.assigned_to,due_at=excluded.due_at,status=excluded.status,notes=excluded.notes where tasks.event_id=e.id;
 else select * into t from public.tasks where id=task_id and tasks.event_id=e.id for update; if t.assigned_to is distinct from auth.uid() or not planora_private.is_member(e.institution_id) then raise exception 'Permission denied'; end if; update public.tasks set status=p->>'status',notes=coalesce(p->>'notes',notes) where id=t.id; end if;
 perform planora_private.log(e.institution_id,'task.save','task',n); return n;
end $$;
create function public.volunteer_action(event_id uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; u uuid:=coalesce(nullif(p->>'user_id','')::uuid,auth.uid()); st text:=coalesce(p->>'status','applied'); begin
 select * into e from public.events where id=event_id;
 if st='applied' and u=auth.uid() and planora_private.can_view_event(e.institution_id,e.id) then
 insert into public.volunteers(institution_id,event_id,user_id) values(e.institution_id,e.id,u) on conflict(event_id,user_id) do nothing;
 elsif planora_private.has_permission(e.institution_id,'event.manage',e.id) then
 insert into public.volunteers(institution_id,event_id,user_id,status,duty,starts_at,ends_at,attended) values(e.institution_id,e.id,u,st,coalesce(p->>'duty',''),nullif(p->>'starts_at','')::timestamptz,nullif(p->>'ends_at','')::timestamptz,coalesce((p->>'attended')::boolean,false)) on conflict(event_id,user_id) do update set status=excluded.status,duty=excluded.duty,starts_at=excluded.starts_at,ends_at=excluded.ends_at,attended=excluded.attended;
 if st='accepted' and coalesce((p->>'can_scan')::boolean,false) then insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(e.institution_id,u,'volunteer','event',e.id) on conflict do nothing; else delete from public.role_assignments where institution_id=e.institution_id and user_id=u and role='volunteer' and scope_id=e.id; end if;
 perform planora_private.notify(e.institution_id,u,'Volunteer assignment updated',e.title||' · '||coalesce(p->>'duty',''),'/opportunities');
 else raise exception 'Permission denied'; end if;
 perform planora_private.log(e.institution_id,'volunteer.'||st,'event',e.id);
end $$;
create function public.publish_announcement(i uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e uuid:=nullif(p->>'event_id','')::uuid; n uuid; begin
 if (e is null and not planora_private.has_permission(i,'institution.manage')) or (e is not null and not planora_private.has_permission(i,'event.manage',e)) then raise exception 'Permission denied'; end if;
 insert into public.announcements(institution_id,event_id,title,body,created_by) values(i,e,p->>'title',p->>'body',auth.uid()) returning id into n;
 insert into public.notifications(institution_id,user_id,title,body,link) select i,m.user_id,p->>'title',p->>'body',case when e is null then '/notifications' else '/events/'||e end from public.memberships m where m.institution_id=i and m.status='active' and (e is null or exists(select 1 from public.registrations r where r.event_id=e and r.user_id=m.user_id and r.status not in ('cancelled','rejected','expired')));
 perform planora_private.log(i,'announcement.publish','announcement',n); return n;
end $$;
create function public.read_notification(notification_id uuid) returns void language sql security definer set search_path='' as $$ update public.notifications set read_at=now() where id=notification_id and user_id=auth.uid() and planora_private.is_member(institution_id) $$;
create function public.save_budget(event_id uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; n uuid; begin
 select * into e from public.events where id=event_id; if not planora_private.has_permission(e.institution_id,'budget.manage',e.id) then raise exception 'Permission denied'; end if;
 insert into public.budget_entries(institution_id,event_id,kind,category,description,amount,receipt_path,created_by) values(e.institution_id,e.id,p->>'kind',p->>'category',p->>'description',(p->>'amount')::numeric,nullif(p->>'receipt_path',''),auth.uid()) returning id into n;
 perform planora_private.log(e.institution_id,'budget.submit','budget',n); return n;
end $$;
create function public.review_budget(entry_id uuid,decision text,reason text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare b public.budget_entries; begin
 select * into b from public.budget_entries where id=entry_id for update; if not planora_private.has_permission(b.institution_id,'budget.approve',b.event_id) or decision not in ('approved','rejected') or length(trim(reason))<3 then raise exception 'Approval permission and review reason required'; end if;
 if b.created_by=auth.uid() then raise exception 'A different reviewer must approve expenses'; end if;
 if b.status<>'pending' then raise exception 'Entry already reviewed'; end if;
 update public.budget_entries set status=decision,reviewed_by=auth.uid(),review_note=reason where id=b.id; perform planora_private.log(b.institution_id,'budget.'||decision,'budget',b.id,jsonb_build_object('reason',reason));
end $$;
create function public.allocate_resource(event_id uuid,resource_id uuid,amount int) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; r public.resources; used int; begin
 select * into e from public.events where id=event_id for update; if not planora_private.has_permission(e.institution_id,'event.manage',e.id) then raise exception 'Permission denied'; end if;
 select * into r from public.resources where id=resource_id and institution_id=e.institution_id for update; if r.id is null then raise exception 'Resource unavailable'; end if;
 select coalesce(sum(a.quantity),0) into used from public.resource_allocations a join public.events x on x.id=a.event_id where a.resource_id=r.id and x.id<>e.id and x.status not in ('CANCELLED','COMPLETED') and x.starts_at<e.ends_at and x.ends_at>e.starts_at;
 if amount<0 or used+amount>r.quantity then raise exception 'Insufficient available resources'; end if;
 if amount=0 then delete from public.resource_allocations where resource_allocations.event_id=e.id and resource_allocations.resource_id=r.id; else insert into public.resource_allocations(institution_id,event_id,resource_id,quantity) values(e.institution_id,e.id,r.id,amount) on conflict(event_id,resource_id) do update set quantity=excluded.quantity; end if;
 perform planora_private.log(e.institution_id,'resource.allocate','event',e.id,jsonb_build_object('resource',r.id,'quantity',amount));
end $$;
create function public.submit_feedback(event_id uuid,rating_value int,comment_text text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin
 select * into e from public.events where id=event_id; if e.status<>'COMPLETED' or not planora_private.is_member(e.institution_id) or not exists(select 1 from public.attendance where attendance.event_id=e.id and user_id=auth.uid()) then raise exception 'Feedback is available to checked-in participants after completion'; end if;
 insert into public.feedback(institution_id,event_id,user_id,rating,comment) values(e.institution_id,e.id,auth.uid(),rating_value,left(comment_text,4000)) on conflict(event_id,user_id) do update set rating=excluded.rating,comment=excluded.comment;
end $$;
create function public.issue_certificates(event_id uuid) returns int language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; n int; begin
 select * into e from public.events where id=event_id; if e.status<>'COMPLETED' or not planora_private.has_permission(e.institution_id,'certificate.manage',e.id) then raise exception 'Complete the event before issuing certificates'; end if;
 insert into public.certificates(institution_id,event_id,user_id,registration_id,recipient_name,event_title,issued_by) select e.institution_id,e.id,a.user_id,a.registration_id,p.full_name,e.title,auth.uid() from public.attendance a join public.profiles p on p.id=a.user_id where a.event_id=e.id on conflict(registration_id) do nothing;
 get diagnostics n=row_count; perform planora_private.log(e.institution_id,'certificates.issue','event',e.id,jsonb_build_object('count',n)); return n;
end $$;
create function public.revoke_certificate(certificate_id uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare c public.certificates; begin select * into c from public.certificates where id=certificate_id; if not planora_private.has_permission(c.institution_id,'certificate.manage',c.event_id) or length(trim(reason))<5 then raise exception 'Permission and reason required'; end if; update public.certificates set revoked_at=now() where id=c.id; perform planora_private.log(c.institution_id,'certificate.revoke','certificate',c.id,jsonb_build_object('reason',reason)); end $$;
create function public.verify_certificate(code text) returns jsonb language sql stable security definer set search_path='' as $$ select jsonb_build_object('valid',c.revoked_at is null,'recipient_name',c.recipient_name,'event_title',c.event_title,'institution',i.name,'issued_at',c.issued_at) from public.certificates c join public.institutions i on i.id=c.institution_id where c.verification_code=code $$;
create function public.completion_report(event_id uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin select * into e from public.events where id=event_id;
 if p ? 'status' then if not planora_private.has_permission(e.institution_id,'event.approve',e.id) or p->>'status' not in ('approved','revision_requested') then raise exception 'Review permission required'; end if; update public.completion_reports set status=p->>'status',reviewed_by=auth.uid(),comments=p->>'comments' where completion_reports.event_id=e.id;
 else if not planora_private.has_permission(e.institution_id,'event.manage',e.id) or e.status<>'COMPLETED' then raise exception 'Completed event and organiser permission required'; end if; insert into public.completion_reports(institution_id,event_id,summary,outcomes,submitted_by) values(e.institution_id,e.id,p->>'summary',p->>'outcomes',auth.uid()) on conflict(event_id) do update set summary=excluded.summary,outcomes=excluded.outcomes,status='submitted',reviewed_by=null,comments=null; end if;
 perform planora_private.log(e.institution_id,'completion_report.update','event',e.id);
end $$;
create function public.participant_directory(event_id uuid,query_text text default '') returns table(registration_id uuid,user_id uuid,name text,registration_number text,status text,team_id uuid,checked_in_at timestamptz,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column
 declare e public.events; begin
 select * into e from public.events where id=event_id; if not(planora_private.has_permission(e.institution_id,'registration.manage',e.id) or planora_private.has_permission(e.institution_id,'attendance.scan',e.id) or planora_private.has_permission(e.institution_id,'report.read',e.id)) then raise exception 'Permission denied'; end if;
 return query select r.id,r.user_id,p.full_name,r.registration_number,r.status,r.team_id,a.checked_in_at,r.created_at from public.registrations r join public.profiles p on p.id=r.user_id left join public.attendance a on a.registration_id=r.id where r.event_id=e.id and (p.full_name ilike '%'||query_text||'%' or r.registration_number ilike '%'||query_text||'%') order by r.created_at desc limit 10000;
end $$;
create function public.institution_users(i uuid,query_text text default '') returns table(user_id uuid,name text,email text,kind text,status text,department_id uuid,student_number text,academic_year int) language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column
 begin if not planora_private.has_permission(i,'users.manage') then raise exception 'Permission denied'; end if; return query select m.user_id,p.full_name,u.email::text,m.kind,m.status,m.department_id,m.student_number,m.academic_year from public.memberships m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where m.institution_id=i and (p.full_name ilike '%'||query_text||'%' or u.email ilike '%'||query_text||'%') order by p.full_name limit 10000; end $$;
create function public.analytics(i uuid,from_date timestamptz,to_date timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column
 declare result jsonb; begin
 if not planora_private.is_member(i) then raise exception 'Permission denied'; end if;
 with visible as (select * from public.events e where e.institution_id=i and starts_at>=from_date and starts_at<to_date and planora_private.has_permission(i,'report.read',e.id)),
 rr as (select r.* from public.registrations r join visible e on e.id=r.event_id), aa as (select a.* from public.attendance a join visible e on e.id=a.event_id)
 select jsonb_build_object('events',(select count(*) from visible),'upcoming',(select count(*) from visible where starts_at>now() and status not in ('CANCELLED','REJECTED')),'pending',(select count(*) from visible where status='PENDING_APPROVAL'),'registrations',(select count(*) from rr),'confirmed',(select count(*) from rr where status='confirmed'),'attendance',(select count(*) from aa),'capacity',(select coalesce(sum(capacity),0) from visible),'unique_participants',(select count(distinct user_id) from rr),'category',coalesce((select jsonb_agg(x) from (select category as name,count(*) as value from visible group by category) x),'[]'),'departments',coalesce((select jsonb_agg(x) from (select coalesce(d.name,'Campus-wide') as name,count(*) as value from visible e left join public.departments d on d.id=e.department_id group by d.name) x),'[]'),'clubs',coalesce((select jsonb_agg(x) from (select coalesce(c.name,'Institution') as name,count(*) as value from visible e left join public.clubs c on c.id=e.club_id group by c.name) x),'[]'),'trend',coalesce((select jsonb_agg(x order by x.name) from (select to_char(created_at,'YYYY-MM-DD') as name,count(*) as value from rr group by 1) x),'[]'),'monthly',coalesce((select jsonb_agg(x order by x.name) from (select to_char(starts_at,'YYYY-MM') as name,count(*) as value from visible group by 1) x),'[]'),'finance',coalesce((select jsonb_agg(x) from (select b.kind as name,sum(b.amount) as value from public.budget_entries b join visible e on e.id=b.event_id where b.status='approved' and (planora_private.has_permission(i,'budget.manage',e.id) or planora_private.has_permission(i,'budget.approve',e.id)) group by b.kind) x),'[]')) into result;
 return result;
end $$;
create function public.save_settings(i uuid,p jsonb) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare cfg jsonb; begin if not planora_private.has_permission(i,'institution.manage') then raise exception 'Permission denied'; end if;
 cfg:=p->'settings'; if (cfg->>'approval_count')::int not between 1 and 10 or (cfg->>'waitlist_hours')::int not between 1 and 168 then raise exception 'Invalid approval count or waitlist expiry'; end if;
 if jsonb_typeof(cfg->'allowed_domains')<>'array' then raise exception 'Domains must be an array'; end if;
 update public.institutions set name=coalesce(p->>'name',name),logo_path=coalesce(p->>'logo_path',logo_path),settings=settings||cfg where id=i; perform planora_private.log(i,'institution.settings','institution',i);
end $$;
create function public.create_support(i uuid,subject_value text,body_value text) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 begin if not planora_private.is_member(i) then raise exception 'Permission denied'; end if; insert into public.support_requests(institution_id,created_by,subject,body) values(i,auth.uid(),subject_value,body_value); end $$;
create function public.platform_action(action text,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare n uuid:=nullif(p->>'id','')::uuid; u uuid:=nullif(p->>'owner_id','')::uuid; begin
 if not planora_private.is_platform_admin() then raise exception 'Platform administrator required'; end if;
 if action='create_institution' then if not exists(select 1 from auth.users where id=u and email_confirmed_at is not null) then raise exception 'Owner must have a verified account'; end if;
 insert into public.institutions(name,slug) values(p->>'name',p->>'slug') returning id into n;
 insert into public.memberships(institution_id,user_id,kind) values(n,u,'staff'); insert into public.role_assignments(institution_id,user_id,role,scope_type,scope_id) values(n,u,'owner','institution',n);
 elsif action='update_institution' then if p ? 'plan' and not exists(select 1 from public.subscription_plans where name=p->>'plan' and active) then raise exception 'Select an active subscription plan'; end if; update public.institutions set status=coalesce(p->>'status',status),plan=coalesce(p->>'plan',plan) where id=n;
 elsif action='category' then insert into public.global_categories(name) values(p->>'name') returning id into n;
 elsif action='plan' then insert into public.subscription_plans(name,features) values(p->>'name',coalesce(p->'features','{}')) returning id into n;
 elsif action='update_plan' then update public.subscription_plans set features=features||coalesce(p->'features','{}'),active=coalesce((p->>'active')::boolean,active) where id=n;
 elsif action='resolve_support' then update public.support_requests set status='resolved' where id=n;
 else raise exception 'Unknown platform action'; end if;
 perform planora_private.log(null,'platform.'||action,'platform',n,p-'owner_id'); return n;
end $$;
create function public.platform_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_column
 begin if not planora_private.is_platform_admin() then raise exception 'Permission denied'; end if; return coalesce((select jsonb_agg(x) from (select i.id,i.name,i.status,i.plan,(select count(*) from public.events e where e.institution_id=i.id) as events,(select count(*) from public.memberships m where m.institution_id=i.id) as members from public.institutions i) x),'[]'); end $$;
-- Service-only jobs: not exposed to browser roles.
create function public.run_waitlist_jobs() returns int language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 declare e record; n int:=0; begin for e in select id from public.events where status='REGISTRATION_OPEN' loop n:=n+planora_private.promote_waitlist(e.id); end loop; return n; end $$;
create function public.claim_notification_emails() returns table(id uuid,email text,title text,body text,link text) language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 begin
 insert into planora_private.email_outbox(notification_id) select n.id from public.notifications n where n.created_at>now()-interval '7 days' and exists(select 1 from public.memberships m where m.institution_id=n.institution_id and m.user_id=n.user_id and m.status='active') and exists(select 1 from public.institutions i where i.id=n.institution_id and i.status='active' and coalesce((i.settings->>'email_notifications')::boolean,false)) on conflict(notification_id) do nothing;
 return query with claimed as (select o.id from planora_private.email_outbox o where (o.status='pending' or (o.status='processing' and o.locked_at<now()-interval '10 minutes')) and o.attempts<5 order by o.created_at limit 50 for update skip locked), updated as (update planora_private.email_outbox o set status='processing',locked_at=now(),attempts=o.attempts+1 from claimed c where o.id=c.id returning o.id,o.notification_id) select o.id,u.email::text,n.title,n.body,n.link from updated o join public.notifications n on n.id=o.notification_id join auth.users u on u.id=n.user_id;
end $$;
create function public.finish_notification_email(job_id uuid,provider_id text default null,error_text text default null) returns void language sql security definer set search_path='' as $$ update planora_private.email_outbox set status=case when error_text is null then 'sent' else 'pending' end,provider_id=finish_notification_email.provider_id,last_error=left(error_text,500),locked_at=null where id=job_id $$;

-- Grant specific API access only after all functions exist.
do $$ declare f record; begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['my_context','update_profile','join_institution','create_invitation','accept_invitations','manage_member','save_directory','save_event','transition_event','review_comment','reschedule_event','register_event','registration_action','process_waitlist','issue_ticket','check_in','correct_attendance','toggle_saved','club_action','save_task','volunteer_action','publish_announcement','read_notification','save_budget','review_budget','allocate_resource','submit_feedback','issue_certificates','revoke_certificate','verify_certificate','completion_report','participant_directory','institution_users','analytics','save_settings','create_support','platform_action','platform_metrics','run_waitlist_jobs','claim_notification_emails','finish_notification_email']) loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature); end loop; end $$;
do $$ declare f record; begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['my_context','update_profile','join_institution','create_invitation','accept_invitations','manage_member','save_directory','save_event','transition_event','review_comment','reschedule_event','register_event','registration_action','process_waitlist','issue_ticket','check_in','correct_attendance','toggle_saved','club_action','save_task','volunteer_action','publish_announcement','read_notification','save_budget','review_budget','allocate_resource','submit_feedback','issue_certificates','revoke_certificate','verify_certificate','completion_report','participant_directory','institution_users','analytics','save_settings','create_support','platform_action','platform_metrics','run_waitlist_jobs','claim_notification_emails','finish_notification_email']) and p.proname not in ('run_waitlist_jobs','claim_notification_emails','finish_notification_email') loop execute format('grant execute on function %s to authenticated',f.signature); end loop; end $$;
grant execute on function public.verify_certificate(text) to anon;
grant execute on function public.run_waitlist_jobs(),public.claim_notification_emails(),public.finish_notification_email(uuid,text,text) to service_role;
revoke execute on all functions in schema planora_private from public,anon,authenticated;
grant execute on function planora_private.is_member(uuid),planora_private.has_permission(uuid,text,uuid),planora_private.can_view_event(uuid,uuid),planora_private.is_platform_admin() to authenticated;
commit;
