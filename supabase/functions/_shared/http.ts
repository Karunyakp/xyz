import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
export const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
};
export function cors(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = required('APP_ORIGIN');
  if (origin && origin !== allowed) throw new Error('Origin not allowed');
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
export function adminClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function userClient(req: Request) {
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Authentication required');
  const token = header.slice(7);
  const client = createClient(required('SUPABASE_URL'), required('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid session');
  return { client, user: data.user };
}
export async function requireCron(req: Request) {
  const expected = required('CRON_SECRET');
  const actual = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  const encode = (s: string) => new TextEncoder().encode(s);
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encode(actual)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encode(expected)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0 || expected.length < 32) throw new Error('Invalid scheduler authentication');
}
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 20000) throw new Error('Request too large');
  const text = await req.text();
  if (text.length > 20000) throw new Error('Request too large');
  return JSON.parse(text) as Record<string, unknown>;
}
