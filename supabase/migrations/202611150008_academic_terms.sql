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
