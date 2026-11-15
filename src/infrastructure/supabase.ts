import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_'),
);
export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
export function db() {
  if (!supabase) throw new Error('Connect your Supabase project to continue.');
  return supabase;
}
export async function rpc<T = void>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
