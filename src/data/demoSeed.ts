// Sample data for demo mode only. Every row is marked source:"demo" and the UI
// labels it as sample data — none of it is a verified real transaction.
import { addDays, subDays, subMonths } from 'date-fns'
import { iso } from '@/domain/finance'
import type { Profile } from '@/domain/types'
import { DEMO_USER, demoStore } from './adapters'

const id = () => crypto.randomUUID()

export const demoProfile = (): Profile => ({
  id: DEMO_USER, full_name: 'Demo user', email: 'demo@axial.local', currency: 'KES', timezone: 'Africa/Nairobi',
  budget_start_day: 1, theme: 'light', reminder_defaults: [3, 1], notify_in_app: true, notify_email: false,
  notify_push: false, hide_amounts: false, custom_categories: [], referral_code: 'DEMO2026', created_at: new Date().toISOString(),
})

export function seedDemo() {
  demoStore.clear()
  const t = new Date()
  const d = (n: number) => iso(subDays(t, n))
  const tx: object[] = []
  const add = (kind: 'income' | 'expense', amount: number, category: string, description: string, on: string, is_recurring = false) =>
    tx.push({ id: id(), user_id: DEMO_USER, kind, amount, currency: 'KES', category, description, occurred_on: on, notes: null, is_recurring, source: 'demo', import_hash: null, created_at: new Date(on).toISOString() })

  for (let m = 0; m < 6; m++) {
    const base = subMonths(t, m)
    const on = (dayOfMonth: number) => { const x = new Date(base.getFullYear(), base.getMonth(), dayOfMonth); return x > t ? null : iso(x) }
    const p = (dom: number, f: (s: string) => void) => { const s = on(dom); if (s) f(s) }
    p(1, (s) => add('income', 38000, 'Freelance', 'Website project payment', s))
    p(15, (s) => add('income', 12000 + m * 500, 'Allowance', 'Monthly upkeep', s))
    p(2, (s) => add('expense', 9500, 'Rent', 'Hostel rent', s, true))
    p(5, (s) => add('expense', 2400, 'Utilities', 'Electricity tokens', s))
    p(6, (s) => add('expense', 3000, 'Utilities', 'Home internet', s, true))
    p(20, (s) => add('expense', 3500 + (m % 2) * 1800, 'Shopping', m % 2 ? 'Jumia order' : 'Naivas household shop', s))
    for (let w = 0; w < 4; w++) {
      p(3 + w * 7, (s) => add('expense', 1450 + ((w * 37 + m * 13) % 600), 'Food', w % 2 ? 'Groceries — Quickmart' : 'Lunch and snacks', s))
      p(4 + w * 7, (s) => add('expense', 650 + ((w + m) % 3) * 120, 'Transport', 'Matatu and Uber rides', s))
    }
    p(12, (s) => add('expense', 1800 + (m % 3) * 700, 'Entertainment', 'Cinema and outing', s))
    p(9, (s) => add('expense', 1500, 'Education', 'Printing and books', s))
    p(18, (s) => add('expense', 1200, 'Business', 'Domain and hosting', s))
  }
  demoStore.write('transactions', tx as never)

  const subs = [
    ['Spotify', 'spotify', 'Entertainment', 299, 'monthly', 2, 'M-Pesa'],
    ['Netflix', 'netflix', 'Entertainment', 1100, 'monthly', 5, 'Visa •• 4821'],
    ['YouTube Premium', 'youtube', 'Entertainment', 459, 'monthly', 11, 'Google Play balance'],
    ['Google One', 'googleone', 'Cloud storage', 2400, 'yearly', 47, 'Visa •• 4821'],
    ['ChatGPT Plus', 'chatgpt', 'Software', 2600, 'monthly', 0, 'Visa •• 4821'],
    ['Microsoft 365', 'microsoft365', 'Software', 7000, 'yearly', 120, 'Visa •• 4821'],
    ['Safaricom Home Fibre', 'safaricom-home', 'Internet', 3000, 'monthly', 21, 'M-Pesa'],
    ['Gym membership', 'gym', 'Health', 2500, 'monthly', 26, 'M-Pesa'],
  ] as const
  const subRows: Record<string, unknown>[] = subs.map(([name, key, category, amount, frequency, inDays, src]) => ({
    id: id(), user_id: DEMO_USER, name, service_key: key, category, amount, currency: 'KES', frequency,
    next_billing_date: iso(addDays(t, inDays)), payment_source: src, notes: null, status: 'active', reminder_days: [3, 1],
    manage_url: null, started_on: iso(subMonths(t, 8)), cancelled_on: null, created_at: subMonths(t, 8).toISOString(),
  }))
  subRows.push({ ...subRows[0], id: id(), name: 'Prime Video', service_key: 'primevideo', amount: 650, status: 'cancelled', next_billing_date: iso(addDays(t, 9)), cancelled_on: d(40), payment_source: 'Visa •• 4821' })
  subRows.push({ ...subRows[0], id: id(), name: 'Xbox Game Pass', service_key: 'xbox', category: 'Gaming', amount: 1200, status: 'paused', next_billing_date: iso(addDays(t, 14)), payment_source: 'Visa •• 4821' })
  demoStore.write('subscriptions', subRows as never)
  const netflix = subRows[1] as { id: string }
  demoStore.write('subscription_prices', [
    { id: id(), subscription_id: netflix.id, user_id: DEMO_USER, amount: 1100, previous_amount: 950, effective_on: d(18), created_at: new Date(d(18)).toISOString() },
  ] as never)

  const budgets = [['Food', 9000], ['Transport', 3500], ['Entertainment', 5000], ['Shopping', 6000], ['Utilities', 6000], ['Subscriptions', 8000]]
  demoStore.write('budgets', budgets.map(([category, amount]) => ({ id: id(), user_id: DEMO_USER, space_id: null, category, amount, period: 'monthly', start_date: null, end_date: null, warn_at_pct: 80, created_at: new Date().toISOString() })) as never)

  const vaults = [
    { name: 'Emergency fund', kind: 'emergency', goal: 60000, target: 240, protected: true, held: 'M-Shwari lock savings', deposits: [5000, 6000, 4000, 7000, 5000] },
    { name: 'New laptop', kind: 'laptop', goal: 95000, target: 150, protected: false, held: 'KCB savings account', deposits: [8000, 10000, 6000, 12000] },
    { name: 'Next semester fees', kind: 'university', goal: 48000, target: 75, protected: true, held: 'Equity savings', deposits: [10000, 8000, 9000] },
  ]
  const vRows: object[] = [], eRows: object[] = []
  vaults.forEach((v, vi) => {
    const vid = id()
    vRows.push({ id: vid, user_id: DEMO_USER, space_id: null, name: v.name, kind: v.kind, goal_amount: v.goal, target_date: iso(addDays(t, v.target)), protected: v.protected, held_at: v.held, archived: false, created_at: subMonths(t, 6).toISOString() })
    v.deposits.forEach((amt, i) => eRows.push({ id: id(), vault_id: vid, user_id: DEMO_USER, kind: 'deposit', amount: amt, occurred_on: d((v.deposits.length - i) * 26 + vi), note: null, created_at: new Date().toISOString() }))
    if (vi === 1) eRows.push({ id: id(), vault_id: vid, user_id: DEMO_USER, kind: 'withdrawal', amount: 3000, occurred_on: d(33), note: 'Phone repair', created_at: new Date().toISOString() })
  })
  demoStore.write('vaults', vRows as never)
  demoStore.write('vault_entries', eRows as never)

  const r = (type: string, name: string, threshold: number | null, extra: object = {}) => ({ id: id(), user_id: DEMO_USER, space_id: null, name, description: '', type, threshold, category: null, vault_id: null, frequency: 'monthly', notify_in_app: true, notify_email: false, active: true, created_at: new Date().toISOString(), ...extra })
  demoStore.write('rules', [
    r('save_percent_of_income', 'Pay myself first', 20, { vault_id: (vRows[0] as { id: string }).id, frequency: 'per_event' }),
    r('category_limit', 'Entertainment cap', 5000, { category: 'Entertainment' }),
    r('budget_threshold', 'Budget early warning', 80),
    r('subscription_price_increase', 'Price watch', null, { frequency: 'per_event' }),
    r('recurring_cap', 'Recurring under 25k', 25000),
  ] as never)

  const sid = id()
  demoStore.write('spaces', [{ id: sid, name: 'Hostel room 14B', kind: 'roommates', currency: 'KES', owner_id: DEMO_USER, approval_threshold: 3000, created_at: subMonths(t, 2).toISOString() }] as never)
  const mate1 = id(), mate2 = id()
  demoStore.write('space_members', [
    { space_id: sid, user_id: DEMO_USER, role: 'owner', display_name: 'You', joined_at: subMonths(t, 2).toISOString() },
    { space_id: sid, user_id: mate1, role: 'member', display_name: 'Brian (sample)', joined_at: subMonths(t, 2).toISOString() },
    { space_id: sid, user_id: mate2, role: 'member', display_name: 'Wanjiku (sample)', joined_at: subMonths(t, 1).toISOString() },
  ] as never)
  const ex = (desc: string, amount: number, by: string, status: string, days: number, category = 'Utilities') =>
    ({ id: id(), space_id: sid, user_id: by, created_by: by, description: desc, amount, category, occurred_on: d(days), paid_by: by, split: [DEMO_USER, mate1, mate2].map((u) => ({ user_id: u, share: Math.round((amount / 3) * 100) / 100 })), status, decided_by: null, decided_at: null, created_at: new Date(d(days)).toISOString() })
  demoStore.write('space_expenses', [
    ex('New microwave', 7800, mate1, 'pending', 1, 'Shopping'),
    ex('Wi-Fi share', 3000, DEMO_USER, 'approved', 6),
    ex('Cooking gas refill', 2900, mate2, 'approved', 12, 'Food'),
    ex('Cleaning supplies', 850, DEMO_USER, 'approved', 15, 'Shopping'),
  ] as never)
  demoStore.write('space_activity', [
    { id: id(), space_id: sid, actor_id: mate1, action: 'requested approval', detail: 'New microwave — 7800', created_at: new Date(d(1)).toISOString() },
    { id: id(), space_id: sid, actor_id: mate2, action: 'joined', detail: 'Wanjiku', created_at: subMonths(t, 1).toISOString() },
  ] as never)
  demoStore.write('budgets', [...demoStore.read('budgets'), { id: id(), user_id: DEMO_USER, space_id: sid, category: 'Utilities', amount: 9000, period: 'monthly', start_date: null, end_date: null, warn_at_pct: 80, created_at: new Date().toISOString() }] as never)
  demoStore.write('vaults', [...demoStore.read('vaults'), { id: id(), user_id: DEMO_USER, space_id: sid, name: 'Room deposit refund buffer', kind: 'rent', goal_amount: 15000, target_date: iso(addDays(t, 90)), protected: false, held_at: 'Shared M-Pesa chama', archived: false, created_at: new Date().toISOString() }] as never)
  demoStore.write('referrals', [
    { id: id(), referrer_id: DEMO_USER, referred_user_id: id(), status: 'qualified', reason: null, points: 100, created_at: new Date(d(40)).toISOString(), qualified_at: new Date(d(30)).toISOString() },
    { id: id(), referrer_id: DEMO_USER, referred_user_id: id(), status: 'pending', reason: null, points: 0, created_at: new Date(d(3)).toISOString(), qualified_at: null },
  ] as never)
  demoStore.write('badges', [{ user_id: DEMO_USER, badge_key: 'no_surprises', earned_at: new Date(d(20)).toISOString() }, { user_id: DEMO_USER, badge_key: 'connector', earned_at: new Date(d(30)).toISOString() }] as never)
  try { localStorage.setItem('axial-demo:profile', JSON.stringify(demoProfile())) } catch { /* ignore */ }
}
