// Creates a sample account in your Supabase project with clearly-labelled demo rows.
// Usage: npm run seed:demo   (reads .env; needs SUPABASE_SERVICE_ROLE_KEY)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]))
const url = env.VITE_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

const email = 'demo@axial.local', password = 'Demo-Axial-2026'
let { data: list } = await sb.auth.admin.listUsers()
let user = list.users.find((u) => u.email === email)
if (!user) ({ data: { user } } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Demo user' } }))
const uid = user.id
for (const t of ['transactions', 'subscriptions', 'budgets', 'vaults', 'rules']) await sb.from(t).delete().eq('user_id', uid)

const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10)
const tx = []
for (let m = 0; m < 4; m++) {
  tx.push({ kind: 'income', amount: 38000, category: 'Freelance', description: 'Website project payment', occurred_on: d(m * 30 + 1) })
  tx.push({ kind: 'expense', amount: 9500, category: 'Rent', description: 'Hostel rent', occurred_on: d(m * 30 + 2), is_recurring: true })
  for (let w = 0; w < 4; w++) tx.push({ kind: 'expense', amount: 1400 + w * 90, category: 'Food', description: 'Groceries', occurred_on: d(m * 30 + w * 7 + 3) })
  tx.push({ kind: 'expense', amount: 2200, category: 'Entertainment', description: 'Cinema and outing', occurred_on: d(m * 30 + 12) })
}
const ins = async (t, rows) => { const { error } = await sb.from(t).insert(rows.map((r) => ({ user_id: uid, ...r }))); if (error) throw new Error(`${t}: ${error.message}`) }
await ins('transactions', tx.map((t) => ({ currency: 'KES', source: 'demo', ...t })))
const next = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
await ins('subscriptions', [
  { name: 'Spotify', service_key: 'spotify', category: 'Entertainment', amount: 299, next_billing_date: next(2), payment_source: 'M-Pesa' },
  { name: 'Netflix', service_key: 'netflix', category: 'Entertainment', amount: 1100, next_billing_date: next(6), payment_source: 'Card' },
  { name: 'Google One', service_key: 'googleone', category: 'Cloud storage', amount: 2400, frequency: 'yearly', next_billing_date: next(40) },
])
await ins('budgets', [{ category: 'Food', amount: 9000 }, { category: 'Entertainment', amount: 5000 }])
await ins('vaults', [{ name: 'Emergency fund', kind: 'emergency', goal_amount: 60000, protected: true, held_at: 'Savings account' }])
await ins('rules', [{ name: 'Budget early warning', type: 'budget_threshold', threshold: 80 }])
console.log(`Seeded ${email} / ${password}`)
