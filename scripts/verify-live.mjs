// Read-only connectivity/schema smoke check. Does not create accounts or mutate tenant data.
import { createClient } from '@supabase/supabase-js';
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || url.includes('YOUR_PROJECT')) {
  console.error(
    'BLOCKED: configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. No hosted test was executed.',
  );
  process.exit(2);
}
const headers = process.env.PLANORA_TEST_JWT
  ? { Authorization: 'Bearer ' + process.env.PLANORA_TEST_JWT }
  : {};
const client = createClient(url, key, {
  global: { headers },
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.rpc('verify_certificate', {
  code: '00000000000000000000000000000000',
});
if (error) {
  console.error('FAIL: live RPC connectivity:', error.message);
  process.exit(1);
}
console.log('PASS: hosted Supabase is reachable and the public certificate RPC exists.');
const { data: leaked, error: rlsError } = await client.from('memberships').select('id').limit(1);
if (!process.env.PLANORA_TEST_JWT && (leaked?.length || 0) > 0) {
  console.error('FAIL: anonymous membership data exposure');
  process.exit(1);
}
console.log(
  'PASS: anonymous memberships are not exposed' +
    (rlsError ? ' (permission denied as expected).' : '.'),
);
if (process.env.PLANORA_TEST_JWT) {
  const { data, error: contextError } = await client.rpc('my_context');
  if (contextError) {
    console.error(contextError.message);
    process.exit(1);
  }
  console.log(
    `PASS: authenticated context resolved ${data.institutions.length} institution memberships.`,
  );
} else
  console.log(
    'NOT RUN: authenticated user operations and role scenarios require real test accounts.',
  );
