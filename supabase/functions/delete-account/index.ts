// Permanently deletes the signed-in user. All their rows cascade from auth.users.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401, headers: cors })

  const { confirm } = await req.json().catch(() => ({ confirm: '' }))
  if (confirm !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Confirmation text did not match' }), { status: 400, headers: cors })
  }
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Spaces this user owns are deleted with them (members lose access to that space's shared data).
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
  return new Response(JSON.stringify({ deleted: true }), { headers: cors })
})
