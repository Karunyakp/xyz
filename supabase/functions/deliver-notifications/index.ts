import { adminClient, json, requireCron, required } from '../_shared/http.ts';
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    await requireCron(req);
    const apiKey = required('RESEND_API_KEY'),
      from = required('EMAIL_FROM'),
      origin = required('APP_ORIGIN');
    const admin = adminClient();
    const { data: jobs, error } = await admin.rpc('claim_notification_emails');
    if (error) throw error;
    let sent = 0,
      failed = 0;
    for (const job of jobs || []) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'planora-notification-' + job.id,
          },
          body: JSON.stringify({
            from,
            to: job.email,
            subject: job.title,
            text: job.body + (job.link ? '\n\n' + origin + job.link : ''),
          }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error('Email provider rejected request');
        const { error: finishError } = await admin.rpc('finish_notification_email', {
          job_id: job.id,
          provider_id: result.id,
        });
        if (finishError) throw finishError;
        sent++;
      } catch (e) {
        failed++;
        await admin.rpc('finish_notification_email', {
          job_id: job.id,
          error_text: e instanceof Error ? e.message : 'Delivery failed',
        });
      }
    }
    return json({ sent, failed });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Delivery failed' }, 400);
  }
});
