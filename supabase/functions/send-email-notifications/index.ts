// Sends queued notification emails through Resend.
// Triggered hourly by pg_cron (see supabase/email-cron.sql.example).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('Forbidden', { status: 403 })
  }
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!resendKey || !from) {
    return Response.json({ sent: 0, error: 'RESEND_API_KEY and EMAIL_FROM are not configured' }, { status: 500 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: queue, error } = await admin
    .from('notifications')
    .select('id, title, body, user_id, profiles:user_id ( email, notify_email )')
    .eq('email_status', 'pending')
    .limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const n of queue ?? []) {
    // deno-lint-ignore no-explicit-any
    const profile = (n as any).profiles
    if (!profile?.email || !profile.notify_email) {
      await admin.from('notifications').update({ email_status: 'skipped' }).eq('id', n.id)
      continue
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: profile.email, subject: n.title, text: `${n.body}\n\n— Axial` }),
    })
    await admin.from('notifications').update({ email_status: res.ok ? 'sent' : 'failed' }).eq('id', n.id)
    if (res.ok) sent++
  }
  return Response.json({ sent })
})
