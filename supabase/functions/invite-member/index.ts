import { adminClient, body, cors, json, required, userClient } from '../_shared/http.ts';
Deno.serve(async (req) => {
  let headers: Record<string, string> = {};
  try {
    headers = cors(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);
    const { client } = await userClient(req);
    const p = await body(req);
    const { data: invitationId, error } = await client.rpc('create_invitation', {
      i: p.institution_id,
      p,
    });
    if (error) throw error;
    // Permission validation and invitation persistence occur with the caller JWT before admin Auth is used.
    const { error: inviteError } = await adminClient().auth.admin.inviteUserByEmail(
      String(p.email),
      { redirectTo: required('APP_ORIGIN') + '/auth/callback' },
    );
    if (inviteError) {
      return json(
        {
          invitation_id: invitationId,
          email_sent: false,
          message:
            'Invitation saved. Auth email was not sent. Existing verified users can sign in and accept pending invitations; check server Auth configuration for new accounts.',
        },
        200,
        headers,
      );
    }
    return json({ invitation_id: invitationId, email_sent: true }, 200, headers);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Invitation failed' }, 400, headers);
  }
});
