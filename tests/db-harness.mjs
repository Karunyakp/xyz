import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;
 create publication supabase_realtime;`);
  const files = (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      await db.exec(await readFile('supabase/migrations/' + file, 'utf8'));
    } catch (e) {
      throw new Error(file + ': ' + e.message, { cause: e });
    }
  }
  return db;
}
export async function asUser(db, id, sql, params = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
