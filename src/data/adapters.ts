// Two interchangeable data backends with the same interface:
//  - live:  Supabase (Postgres + RLS) — real accounts
//  - demo:  this browser's localStorage — clearly labelled sample data, never synced
import type { TableName, Tables } from '@/domain/types'
import { supabase } from './supabase'

export type Row<T extends TableName> = Tables[T]
export type Match = Record<string, string | number | boolean | null>

export interface Adapter {
  list<T extends TableName>(t: T): Promise<Row<T>[]>
  insert<T extends TableName>(t: T, rows: Partial<Row<T>>[], onConflict?: string): Promise<Row<T>[]>
  update<T extends TableName>(t: T, match: Match, patch: Partial<Row<T>>): Promise<void>
  remove<T extends TableName>(t: T, match: Match): Promise<void>
  rpc<R = unknown>(fn: string, args: Record<string, unknown>): Promise<R>
}

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

export const liveAdapter = (): Adapter => {
  const sb = supabase!
  return {
    async list(t) {
      const order = t === 'space_members' ? 'joined_at' : t === 'badges' ? 'earned_at' : 'created_at'
      const { data, error } = await sb.from(t).select('*').order(order, { ascending: false }).limit(5000)
      fail(error)
      return (data ?? []).map(numify) as never
    },
    async insert(t, rows, onConflict) {
      const q = onConflict ? sb.from(t).upsert(rows as never, { onConflict, ignoreDuplicates: true }) : sb.from(t).insert(rows as never)
      const { data, error } = await q.select('*')
      fail(error)
      return (data ?? []).map(numify) as never
    },
    async update(t, match, patch) {
      const { error } = await sb.from(t).update(patch as never).match(match as never)
      fail(error)
    },
    async remove(t, match) {
      const { error } = await sb.from(t).delete().match(match as never)
      fail(error)
    },
    async rpc(fn, args) {
      const { data, error } = await sb.rpc(fn, args)
      fail(error)
      return data as never
    },
  }
}

// Postgres numeric arrives as string — normalise money columns.
const MONEY = ['amount', 'goal_amount', 'threshold', 'previous_amount', 'approval_threshold', 'points', 'gross_salary', 'total_gross', 'total_net', 'employer_cost']
function numify(r: Record<string, unknown>) {
  for (const k of MONEY) if (typeof r[k] === 'string') r[k] = Number(r[k])
  return r
}

// ---------------------------------------------------------------------------
// Demo adapter
// ---------------------------------------------------------------------------
export const DEMO_USER = '00000000-0000-4000-8000-00000000d3e0'
const KEY = 'axial-demo:'
const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

export const demoStore = {
  read<T extends TableName>(t: T): Row<T>[] {
    try { return JSON.parse(localStorage.getItem(KEY + t) ?? '[]') } catch { return [] }
  },
  write<T extends TableName>(t: T, rows: Row<T>[]) {
    try { localStorage.setItem(KEY + t, JSON.stringify(rows)) } catch { /* storage full or blocked */ }
  },
  clear() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(KEY)).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
  },
}

const matches = (r: Record<string, unknown>, m: Match) => Object.entries(m).every(([k, v]) => r[k] === v)

export const demoAdapter = (): Adapter => {
  const a: Adapter = {
    async list(t) {
      return [...demoStore.read(t)].sort((x, y) => String((y as never as { created_at?: string }).created_at ?? '').localeCompare(String((x as never as { created_at?: string }).created_at ?? '')))
    },
    async insert(t, rows, onConflict) {
      const all = demoStore.read(t) as unknown as Record<string, unknown>[]
      const keys = onConflict?.split(',')
      const created: Record<string, unknown>[] = []
      for (const r of rows as Record<string, unknown>[]) {
        const row: Record<string, unknown> = { id: uuid(), user_id: DEMO_USER, created_at: now(), ...r }
        if (t === 'space_expenses') {
          const space = demoStore.read('spaces').find((s) => s.id === row.space_id)
          row.status = space?.approval_threshold != null && Number(row.amount) >= space.approval_threshold ? 'pending' : 'approved'
          logActivity(String(row.space_id), row.status === 'pending' ? 'requested approval' : 'added expense', `${row.description} — ${row.amount}`)
        }
        if (keys && all.some((x) => keys.every((k) => x[k] === row[k]))) continue
        all.unshift(row)
        created.push(row)
      }
      demoStore.write(t, all as never)
      return created as never
    },
    async update(t, m, patch) {
      demoStore.write(t, demoStore.read(t).map((r) => (matches(r as never, m) ? { ...r, ...patch } : r)) as never)
    },
    async remove(t, m) {
      demoStore.write(t, demoStore.read(t).filter((r) => !matches(r as never, m)) as never)
      if (t === 'vaults') demoStore.write('vault_entries', demoStore.read('vault_entries').filter((e) => e.vault_id !== m.id))
      if (t === 'subscriptions') demoStore.write('subscription_prices', demoStore.read('subscription_prices').filter((e) => e.subscription_id !== m.id))
      if (t === 'rules') demoStore.write('rule_events', demoStore.read('rule_events').filter((e) => e.rule_id !== m.id))
    },
    async rpc(fn, args) {
      if (fn === 'create_space') {
        const id = uuid()
        await a.insert('spaces', [{ id, name: String(args.p_name), kind: args.p_kind as never, currency: 'KES', owner_id: DEMO_USER, approval_threshold: (args.p_threshold as number) ?? null }])
        await a.insert('space_members', [{ space_id: id, user_id: DEMO_USER, role: 'owner', display_name: String(args.p_display_name || 'You'), joined_at: now() }])
        logActivity(id, 'created', String(args.p_name))
        return id as never
      }
      if (fn === 'decide_space_expense') {
        const exp = demoStore.read('space_expenses').find((e) => e.id === args.p_expense)
        if (!exp) throw new Error('Expense not found')
        if (exp.created_by === DEMO_USER) throw new Error('Another member has to approve your own request')
        if (exp.status !== 'pending') throw new Error('This expense was already decided')
        await a.update('space_expenses', { id: exp.id }, { status: args.p_approve ? 'approved' : 'rejected', decided_by: DEMO_USER, decided_at: now() })
        logActivity(exp.space_id, args.p_approve ? 'approved' : 'rejected', exp.description)
        return null as never
      }
      if (fn === 'refresh_badges' || fn === 'accept_space_invite') return null as never
      throw new Error(`${fn} is not available in demo mode`)
    },
  }
  return a
}

function logActivity(space_id: string, action: string, detail: string) {
  const all = demoStore.read('space_activity')
  all.unshift({ id: uuid(), space_id, actor_id: DEMO_USER, action, detail, created_at: now() })
  demoStore.write('space_activity', all)
}
