-- PLANORA: tenant model, scoped authorization, domain records.
begin;
create schema if not exists planora_private;
revoke all on schema planora_private from public;
grant usage on schema planora_private to authenticated;

create table public.institutions (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 160), slug text not null unique check(slug ~ '^[a-z0-9-]+$'),
 logo_path text, status text not null default 'active' check(status in ('active','suspended')), plan text not null default 'starter',
 settings jsonb not null default '{"timezone":"Asia/Kolkata","allowed_domains":[],"external_registration":false,"approval_required":true,"approval_count":1,"waitlist_hours":24}', created_at timestamptz not null default now()
);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '', avatar_path text, interests text[] not null default '{}', skills text[] not null default '{}', bio text not null default '', created_at timestamptz not null default now());
create table public.platform_admins (user_id uuid primary key references auth.users(id));
create table public.departments (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), name text not null, code text not null, description text not null default '', unique(institution_id,id),unique(institution_id,code));
create table public.memberships (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), user_id uuid not null references auth.users(id), department_id uuid, kind text not null default 'student' check(kind in ('student','staff','external')), status text not null default 'active' check(status in ('active','inactive')), student_number text, academic_year int check(academic_year between 1 and 8), created_at timestamptz not null default now(), unique(institution_id,user_id),unique(institution_id,id), foreign key(institution_id,department_id) references public.departments(institution_id,id));
create table public.roles (key text primary key, label text not null, scopes text[] not null);
create table public.permissions (key text primary key);
create table public.role_permissions (role text references public.roles(key), permission text references public.permissions(key), primary key(role,permission));
create table public.role_assignments (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),user_id uuid not null,role text not null references public.roles(key),scope_type text not null check(scope_type in ('institution','department','club','event')),scope_id uuid not null,created_at timestamptz not null default now(),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id),unique(institution_id,user_id,role,scope_type,scope_id));
create table public.clubs (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),department_id uuid,name text not null,description text not null default '',logo_path text,accepting_members boolean not null default true,unique(institution_id,id),unique(institution_id,name),foreign key(institution_id,department_id) references public.departments(institution_id,id));
create table public.club_memberships (id uuid primary key default gen_random_uuid(),institution_id uuid not null,club_id uuid not null,user_id uuid not null,status text not null default 'following' check(status in ('following','applied','accepted','rejected')),created_at timestamptz not null default now(),unique(club_id,user_id),foreign key(institution_id,club_id) references public.clubs(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.venues (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),name text not null,building text not null default '',room text not null default '',floor text not null default '',capacity int not null check(capacity>0),equipment text[] not null default '{}',restrictions text not null default '',maintenance boolean not null default false,unique(institution_id,id));
create table public.resources (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),name text not null,quantity int not null check(quantity>0),description text not null default '',unique(institution_id,id));
create table public.events (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),department_id uuid,club_id uuid,created_by uuid not null,
 title text not null check(length(title) between 3 and 180),description text not null default '',objectives text not null default '',category text not null default 'Technical',event_type text not null default 'Workshop',mode text not null default 'offline' check(mode in ('online','offline','hybrid')),
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','REVISION_REQUESTED','APPROVED','REJECTED','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING','COMPLETED','CANCELLED')),
 starts_at timestamptz not null,ends_at timestamptz not null,registration_deadline timestamptz not null,timezone text not null default 'Asia/Kolkata',venue_id uuid,online_url text not null default '',capacity int not null check(capacity>0),waitlist_enabled boolean not null default true,manual_approval boolean not null default false,
 is_team boolean not null default false,team_min int not null default 2 check(team_min>=2),team_max int not null default 5,allow_external boolean not null default false,eligible_departments uuid[] not null default '{}',eligible_years int[] not null default '{}',questions jsonb not null default '[]',agenda jsonb not null default '[]',faqs jsonb not null default '[]',rules text not null default '',instructions text not null default '',contact text not null default '',cover_path text,attachments jsonb not null default '[]',estimated_budget numeric(12,2) not null default 0 check(estimated_budget>=0),fee numeric(12,2) not null default 0 check(fee=0),featured boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(institution_id,id),foreign key(institution_id,department_id) references public.departments(institution_id,id),foreign key(institution_id,club_id) references public.clubs(institution_id,id),foreign key(institution_id,venue_id) references public.venues(institution_id,id),foreign key(institution_id,created_by) references public.memberships(institution_id,user_id),check(ends_at>starts_at),check(registration_deadline<=starts_at),check(team_max>=team_min)
);
create table public.approvals (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,reviewer_id uuid not null references auth.users(id),decision text not null check(decision in ('APPROVED','REJECTED','REVISION_REQUESTED','COMMENT')),comments text not null default '',version timestamptz not null,created_at timestamptz not null default now(),foreign key(institution_id,event_id) references public.events(institution_id,id));
create table public.workflow_history (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,previous_status text,new_status text not null,actor_id uuid references auth.users(id),reason text not null default '',created_at timestamptz not null default now(),foreign key(institution_id,event_id) references public.events(institution_id,id));
create table public.venue_bookings (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null unique,venue_id uuid not null,starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'requested' check(status in ('requested','confirmed','cancelled')),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,venue_id) references public.venues(institution_id,id),check(ends_at>starts_at));
create table public.resource_allocations (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,resource_id uuid not null,quantity int not null check(quantity>0),unique(event_id,resource_id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,resource_id) references public.resources(institution_id,id));
create table public.teams (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,name text not null,leader_id uuid not null,join_code text not null unique default replace(gen_random_uuid()::text,'-',''),unique(institution_id,id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,leader_id) references public.memberships(institution_id,user_id));
create table public.registrations (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,user_id uuid not null,team_id uuid,status text not null check(status in ('pending','confirmed','waitlisted','invited','cancelled','rejected','expired')),registration_number text not null unique default ('PL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),answers jsonb not null default '{}',invitation_expires_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(event_id,user_id),unique(institution_id,id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id),foreign key(institution_id,team_id) references public.teams(institution_id,id));
create table planora_private.ticket_secrets (registration_id uuid primary key references public.registrations(id),token_hash text not null unique,issued_at timestamptz not null default now());
create table public.attendance (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,registration_id uuid not null unique,user_id uuid not null,checked_in_by uuid not null references auth.users(id),checked_in_at timestamptz not null default now(),method text not null check(method in ('qr','manual')),note text not null default '',foreign key(institution_id,registration_id) references public.registrations(institution_id,id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.saved_events (institution_id uuid not null,event_id uuid not null,user_id uuid not null,primary key(event_id,user_id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.volunteers (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,user_id uuid not null,status text not null default 'applied' check(status in ('applied','accepted','rejected')),duty text not null default '',starts_at timestamptz,ends_at timestamptz,attended boolean not null default false,unique(event_id,user_id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.tasks (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,title text not null,assigned_to uuid,due_at timestamptz,status text not null default 'todo' check(status in ('todo','doing','done','blocked')),notes text not null default '',foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,assigned_to) references public.memberships(institution_id,user_id));
create table public.announcements (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),event_id uuid,title text not null,body text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(institution_id,event_id) references public.events(institution_id,id));
create table public.notifications (id uuid primary key default gen_random_uuid(),institution_id uuid not null,user_id uuid not null,title text not null,body text not null default '',link text,read_at timestamptz,created_at timestamptz not null default now(),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.budget_entries (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,kind text not null check(kind in ('allocation','expense','sponsorship','reimbursement')),category text not null,description text not null,amount numeric(12,2) not null check(amount>0),status text not null default 'pending' check(status in ('pending','approved','rejected')),receipt_path text,created_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),review_note text,created_at timestamptz not null default now(),foreign key(institution_id,event_id) references public.events(institution_id,id));
create table public.feedback (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,user_id uuid not null,rating int not null check(rating between 1 and 5),comment text not null default '',created_at timestamptz not null default now(),unique(event_id,user_id),foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.certificates (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null,user_id uuid not null,registration_id uuid not null unique,recipient_name text not null,event_title text not null,verification_code text not null unique default replace(gen_random_uuid()::text,'-',''),issued_by uuid not null references auth.users(id),issued_at timestamptz not null default now(),revoked_at timestamptz,foreign key(institution_id,event_id) references public.events(institution_id,id),foreign key(institution_id,registration_id) references public.registrations(institution_id,id),foreign key(institution_id,user_id) references public.memberships(institution_id,user_id));
create table public.completion_reports (id uuid primary key default gen_random_uuid(),institution_id uuid not null,event_id uuid not null unique,summary text not null,outcomes text not null,status text not null default 'submitted' check(status in ('submitted','approved','revision_requested')),submitted_by uuid not null references auth.users(id),reviewed_by uuid references auth.users(id),comments text,created_at timestamptz not null default now(),foreign key(institution_id,event_id) references public.events(institution_id,id));
create table public.invitations (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),email text not null,role text not null references public.roles(key),scope_type text not null default 'institution',scope_id uuid not null,department_id uuid,invited_by uuid not null references auth.users(id),expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz,created_at timestamptz not null default now(),foreign key(institution_id,department_id) references public.departments(institution_id,id));
create table public.audit_logs (id uuid primary key default gen_random_uuid(),institution_id uuid references public.institutions(id),actor_id uuid,action text not null,entity_type text not null,entity_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.support_requests (id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),created_by uuid not null references auth.users(id),subject text not null,body text not null,status text not null default 'open' check(status in ('open','resolved')),created_at timestamptz not null default now());
create table public.global_categories (id uuid primary key default gen_random_uuid(),name text not null unique,enabled boolean not null default true);
create table public.subscription_plans (id uuid primary key default gen_random_uuid(),name text not null unique,features jsonb not null default '{}',active boolean not null default true);
create table planora_private.email_outbox (id uuid primary key default gen_random_uuid(),notification_id uuid not null unique references public.notifications(id),status text not null default 'pending',attempts int not null default 0,locked_at timestamptz,provider_id text,last_error text,created_at timestamptz not null default now());

insert into public.roles values
 ('owner','Institution owner',array['institution']),('admin','College administrator',array['institution']),('hod','Department administrator',array['department']),('faculty','Faculty coordinator',array['institution','department','club','event']),('club_admin','Club coordinator',array['club']),('organiser','Event organiser',array['institution','department','club','event']),('volunteer','Check-in volunteer',array['event']),('student','Student',array['institution']),('external','External participant',array['institution']);
insert into public.permissions values ('institution.manage'),('users.manage'),('directory.manage'),('event.create'),('event.manage'),('event.approve'),('registration.manage'),('attendance.scan'),('budget.manage'),('budget.approve'),('certificate.manage'),('report.read'),('audit.read');
insert into public.role_permissions select r.key,p.key from public.roles r cross join public.permissions p where r.key in ('owner','admin');
insert into public.role_permissions select r,p from unnest(array['hod','faculty']) r cross join unnest(array['event.approve','budget.approve','report.read']) p;
insert into public.role_permissions select r,p from unnest(array['hod','club_admin','organiser']) r cross join unnest(array['event.create','event.manage','registration.manage','attendance.scan','budget.manage','certificate.manage','report.read']) p on conflict do nothing;
insert into public.role_permissions values ('volunteer','attendance.scan');
insert into public.global_categories(name) select unnest(array['Technical','Hackathon','Workshop','Seminar','Cultural','Sports','Competition','Entrepreneurship','Industrial visit','Career','Volunteering','External']);
insert into public.subscription_plans(name,features) values ('starter','{"billing":"unconfigured","multi_tenant":true}');

create function planora_private.is_member(i uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.institutions t on t.id=m.institution_id join auth.users u on u.id=m.user_id where m.institution_id=i and m.user_id=auth.uid() and m.status='active' and t.status='active' and u.email_confirmed_at is not null)
$$;
create function planora_private.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.platform_admins where user_id=auth.uid())$$;
create function planora_private.has_permission(i uuid,p text,s uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select planora_private.is_member(i) and exists(select 1 from public.role_assignments a join public.role_permissions rp on rp.role=a.role where a.institution_id=i and a.user_id=auth.uid() and rp.permission=p and (
 (a.scope_type='institution' and a.scope_id=i) or (a.scope_id=s and a.scope_type in ('department','club','event')) or
 exists(select 1 from public.events e where e.id=s and e.institution_id=i and ((a.scope_type='department' and a.scope_id=e.department_id) or (a.scope_type='club' and a.scope_id=e.club_id))) or
 exists(select 1 from public.clubs c where c.id=s and c.institution_id=i and a.scope_type='department' and a.scope_id=c.department_id)))
$$;
create function planora_private.can_view_event(i uuid,e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select planora_private.is_member(i) and exists(select 1 from public.events x where x.id=e and x.institution_id=i and (x.status in ('PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING','COMPLETED') or planora_private.has_permission(i,'event.manage',e) or planora_private.has_permission(i,'event.approve',e) or planora_private.has_permission(i,'attendance.scan',e) or exists(select 1 from public.registrations r where r.event_id=e and r.user_id=auth.uid())))
$$;
create function planora_private.log(i uuid,a text,t text,e uuid,d jsonb default '{}') returns void language sql security definer set search_path='' as $$insert into public.audit_logs(institution_id,actor_id,action,entity_type,entity_id,details) values(i,auth.uid(),a,t,e,d)$$;
create function planora_private.notify(i uuid,u uuid,t text,b text,l text) returns void language sql security definer set search_path='' as $$insert into public.notifications(institution_id,user_id,title,body,link) values(i,u,t,b,l)$$;
create function planora_private.feature_enabled(i uuid,feature text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.active and coalesce((p.features->>feature)::boolean,true) from public.institutions t join public.subscription_plans p on p.name=t.plan where t.id=i),false)
$$;
create function planora_private.on_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
 begin insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),120)); return new; end $$;
create trigger planora_auth_user after insert on auth.users for each row execute function planora_private.on_auth_user();

-- No client can directly mutate workflow or operational tables; RPCs are the write boundary.
do $$ declare t record; begin for t in select tablename from pg_tables where schemaname='public' and tablename=any(array['institutions','profiles','platform_admins','departments','memberships','roles','permissions','role_permissions','role_assignments','clubs','club_memberships','venues','resources','events','approvals','workflow_history','venue_bookings','resource_allocations','teams','registrations','attendance','saved_events','volunteers','tasks','announcements','notifications','budget_entries','feedback','certificates','completion_reports','invitations','audit_logs','support_requests','global_categories','subscription_plans']) loop execute format('alter table public.%I enable row level security',t.tablename); execute format('revoke all on public.%I from anon, authenticated',t.tablename); execute format('grant select on public.%I to authenticated',t.tablename); end loop; end $$;
create policy institution_read on public.institutions for select to authenticated using(planora_private.is_member(id) or planora_private.is_platform_admin());
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or exists(select 1 from public.memberships m where m.user_id=profiles.id and planora_private.has_permission(m.institution_id,'users.manage')));
create policy membership_read on public.memberships for select to authenticated using((user_id=auth.uid() and planora_private.is_member(institution_id)) or planora_private.has_permission(institution_id,'users.manage'));
create policy role_read on public.role_assignments for select to authenticated using((user_id=auth.uid() and planora_private.is_member(institution_id)) or planora_private.has_permission(institution_id,'users.manage'));
create policy platform_self on public.platform_admins for select to authenticated using(user_id=auth.uid());
create policy roles_read on public.roles for select to authenticated using(true);
create policy permission_read on public.permissions for select to authenticated using(true);
create policy role_permission_read on public.role_permissions for select to authenticated using(true);
create policy categories_read on public.global_categories for select to authenticated using(true);
create policy plans_read on public.subscription_plans for select to authenticated using(planora_private.is_platform_admin());
create policy events_read on public.events for select to authenticated using(planora_private.can_view_event(institution_id,id));
create policy registration_read on public.registrations for select to authenticated using(planora_private.is_member(institution_id) and (user_id=auth.uid() or planora_private.has_permission(institution_id,'registration.manage',event_id) or planora_private.has_permission(institution_id,'attendance.scan',event_id) or planora_private.has_permission(institution_id,'report.read',event_id)));
create policy attendance_read on public.attendance for select to authenticated using(planora_private.is_member(institution_id) and (user_id=auth.uid() or planora_private.has_permission(institution_id,'attendance.scan',event_id) or planora_private.has_permission(institution_id,'report.read',event_id)));
create policy teams_read on public.teams for select to authenticated using(planora_private.is_member(institution_id) and (leader_id=auth.uid() or exists(select 1 from public.registrations r where r.team_id=teams.id and r.user_id=auth.uid()) or planora_private.has_permission(institution_id,'registration.manage',event_id)));
create policy saved_read on public.saved_events for select to authenticated using(user_id=auth.uid() and planora_private.is_member(institution_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and planora_private.is_member(institution_id));
create policy club_members_read on public.club_memberships for select to authenticated using(planora_private.is_member(institution_id) and (user_id=auth.uid() or planora_private.has_permission(institution_id,'event.manage',club_id)));
create policy volunteer_read on public.volunteers for select to authenticated using(planora_private.is_member(institution_id) and (user_id=auth.uid() or planora_private.has_permission(institution_id,'event.manage',event_id)));
create policy task_read on public.tasks for select to authenticated using(planora_private.is_member(institution_id) and (assigned_to=auth.uid() or planora_private.has_permission(institution_id,'event.manage',event_id)));
create policy announcement_read on public.announcements for select to authenticated using(planora_private.is_member(institution_id) and (event_id is null or planora_private.can_view_event(institution_id,event_id)));
create policy budget_read on public.budget_entries for select to authenticated using(planora_private.has_permission(institution_id,'budget.manage',event_id) or planora_private.has_permission(institution_id,'budget.approve',event_id));
create policy feedback_read on public.feedback for select to authenticated using((user_id=auth.uid() and planora_private.is_member(institution_id)) or planora_private.has_permission(institution_id,'report.read',event_id));
create policy certificates_read on public.certificates for select to authenticated using((user_id=auth.uid() and planora_private.is_member(institution_id)) or planora_private.has_permission(institution_id,'certificate.manage',event_id));
create policy reports_read on public.completion_reports for select to authenticated using(planora_private.has_permission(institution_id,'report.read',event_id));
create policy invitation_read on public.invitations for select to authenticated using(planora_private.has_permission(institution_id,'users.manage'));
create policy audit_read on public.audit_logs for select to authenticated using(planora_private.has_permission(institution_id,'audit.read') or (institution_id is null and planora_private.is_platform_admin()));
create policy support_read on public.support_requests for select to authenticated using((created_by=auth.uid() and planora_private.is_member(institution_id)) or planora_private.has_permission(institution_id,'institution.manage') or planora_private.is_platform_admin());
do $$ declare n text; begin foreach n in array array['departments','clubs','venues','resources','venue_bookings'] loop execute format('create policy tenant_read on public.%I for select to authenticated using(planora_private.is_member(institution_id) and not exists(select 1 from public.memberships m where m.institution_id=%I.institution_id and m.user_id=auth.uid() and m.kind=''external''))',n,n); end loop;
 foreach n in array array['approvals','workflow_history','resource_allocations'] loop execute format('create policy operations_read on public.%I for select to authenticated using(planora_private.has_permission(institution_id,''event.manage'',event_id) or planora_private.has_permission(institution_id,''event.approve'',event_id))',n); end loop; end $$;
create index event_discovery_idx on public.events(institution_id,status,starts_at);
create index event_search_idx on public.events using gin(to_tsvector('english',title||' '||description));
create index registrations_event_status_idx on public.registrations(event_id,status,created_at,id);
create index registrations_user_idx on public.registrations(user_id,institution_id);
create index memberships_user_idx on public.memberships(user_id,institution_id,status);
create index roles_user_idx on public.role_assignments(user_id,institution_id);
create index bookings_time_idx on public.venue_bookings(venue_id,starts_at,ends_at) where status='confirmed';
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index audit_tenant_idx on public.audit_logs(institution_id,created_at desc);
revoke execute on all functions in schema planora_private from public,anon,authenticated;
grant execute on function planora_private.is_member(uuid),planora_private.has_permission(uuid,text,uuid),planora_private.can_view_event(uuid,uuid),planora_private.is_platform_admin() to authenticated;
commit;
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
begin;
-- Private storage only. Object keys: institution UUID / event UUID / random filename.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-media','event-media',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),('receipts','receipts',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create function planora_private.storage_event(path text) returns uuid language plpgsql immutable set search_path='' as $$
#variable_conflict use_column
 begin return split_part(path,'/',2)::uuid; exception when invalid_text_representation then return null; end $$;
create function planora_private.storage_institution(path text) returns uuid language plpgsql immutable set search_path='' as $$
#variable_conflict use_column
 begin return split_part(path,'/',1)::uuid; exception when invalid_text_representation then return null; end $$;
grant execute on function planora_private.storage_event(text),planora_private.storage_institution(text) to authenticated;
create policy planora_media_read on storage.objects for select to authenticated using(bucket_id='event-media' and planora_private.can_view_event(planora_private.storage_institution(name),planora_private.storage_event(name)));
create policy planora_media_insert on storage.objects for insert to authenticated with check(bucket_id='event-media' and planora_private.has_permission(planora_private.storage_institution(name),'event.manage',planora_private.storage_event(name)) and exists(select 1 from public.events e where e.id=planora_private.storage_event(name) and e.institution_id=planora_private.storage_institution(name)));
create policy planora_receipt_read on storage.objects for select to authenticated using(bucket_id='receipts' and (planora_private.has_permission(planora_private.storage_institution(name),'budget.manage',planora_private.storage_event(name)) or planora_private.has_permission(planora_private.storage_institution(name),'budget.approve',planora_private.storage_event(name))));
create policy planora_receipt_insert on storage.objects for insert to authenticated with check(bucket_id='receipts' and planora_private.has_permission(planora_private.storage_institution(name),'budget.manage',planora_private.storage_event(name)) and exists(select 1 from public.events e where e.id=planora_private.storage_event(name) and e.institution_id=planora_private.storage_institution(name)));
-- Immutable uploaded names; replacing a document means uploading a fresh random name.
alter publication supabase_realtime add table public.attendance,public.notifications,public.tasks,public.events,public.registrations;
commit;
begin;
alter table public.events add column search_vector tsvector generated always as (to_tsvector('english',title||' '||description)) stored;
create index events_search_vector_idx on public.events using gin(search_vector);
commit;
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
begin;

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  name text not null check (length(trim(name)) between 1 and 120),
  academic_year text not null check (length(trim(academic_year)) between 1 and 40),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (institution_id, id),
  unique (institution_id, name, academic_year),
  check (ends_on > starts_on)
);
alter table public.academic_terms enable row level security;
create policy academic_terms_read on public.academic_terms for select to authenticated using (
  planora_private.is_member(institution_id) and exists (
    select 1 from public.memberships m where m.institution_id=academic_terms.institution_id
    and m.user_id=auth.uid() and m.kind<>'external'
  )
);
revoke all on public.academic_terms from anon,authenticated;
grant select on public.academic_terms to authenticated;

create function public.save_academic_term(i uuid,p jsonb,record_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare n uuid;
begin
  if not planora_private.has_permission(i,'directory.manage') then raise exception 'Permission denied'; end if;
  if record_id is null then
    insert into public.academic_terms(institution_id,name,academic_year,starts_on,ends_on)
      values(i,trim(p->>'name'),trim(p->>'academic_year'),(p->>'starts_on')::date,(p->>'ends_on')::date)
      returning id into n;
  else
    update public.academic_terms set name=trim(p->>'name'),academic_year=trim(p->>'academic_year'),
      starts_on=(p->>'starts_on')::date,ends_on=(p->>'ends_on')::date
      where id=record_id and institution_id=i returning id into n;
    if n is null then raise exception 'Term not found in institution'; end if;
  end if;
  perform planora_private.log(i,'academic_term.save','academic_term',n,p);
  return n;
end $$;
revoke execute on function public.save_academic_term(uuid,jsonb,uuid) from public,anon;
grant execute on function public.save_academic_term(uuid,jsonb,uuid) to authenticated;
commit;
