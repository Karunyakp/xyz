begin;
alter table public.events add column search_vector tsvector generated always as (to_tsvector('english',title||' '||description)) stored;
create index events_search_vector_idx on public.events using gin(search_vector);
commit;
