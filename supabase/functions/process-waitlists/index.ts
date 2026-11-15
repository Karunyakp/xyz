import { adminClient, json, requireCron } from '../_shared/http.ts';
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    await requireCron(req);
    const { data, error } = await adminClient().rpc('run_waitlist_jobs');
    if (error) throw error;
    return json({ promoted: data });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Processing failed' }, 400);
  }
});
