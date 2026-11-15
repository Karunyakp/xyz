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
