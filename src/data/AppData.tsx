// Session + data context. Loads every table once, exposes typed mutations,
// and runs the automations (rule evaluation, in-demo reminders) after changes.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile, TableName, Tables } from '@/domain/types'
import { evaluateRules } from '@/domain/rules'
import { iso, reminderKey, remindersDueToday, rollForward } from '@/domain/finance'
import { DEMO_USER, demoAdapter, liveAdapter, type Adapter, type Match, type Row } from './adapters'
import { supabase, hasSupabase } from './supabase'
import { demoProfile, seedDemo, type DemoUser } from './demoSeed'

export type Mode = 'demo' | 'live'
type Data = { [K in TableName]: Tables[K][] }
const TABLES: TableName[] = ['transactions', 'budgets', 'vaults', 'vault_entries', 'subscriptions', 'subscription_prices', 'rules', 'rule_events', 'notifications', 'spaces', 'space_members', 'space_invites', 'space_expenses', 'space_activity', 'referrals', 'badges']
const empty = () => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Data

interface Ctx {
  ready: boolean
  mode: Mode | null
  session: Session | null
  userId: string | null
  profile: Profile | null
  data: Data
  loading: boolean
  error: string | null
  startDemo(who?: DemoUser): void
  resetDemo(): void
  signOut(): Promise<void>
  saveProfile(p: Partial<Profile>): Promise<void>
  reload(): Promise<void>
  insert<T extends TableName>(t: T, rows: Partial<Row<T>>[], onConflict?: string): Promise<Row<T>[]>
  update<T extends TableName>(t: T, match: Match, patch: Partial<Row<T>>): Promise<void>
  remove<T extends TableName>(t: T, match: Match): Promise<void>
  rpc<R = unknown>(fn: string, args: Record<string, unknown>): Promise<R>
}

const AppCtx = createContext<Ctx>(null as never)
export const useApp = () => useContext(AppCtx)
export const useData = () => useContext(AppCtx).data

const MODE_KEY = 'axial-mode'
const readDemoProfile = (): Profile | null => { try { return JSON.parse(localStorage.getItem('axial-demo:profile') ?? 'null') } catch { return null } }
const readMode = (): Mode | null => { try { return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : null } catch { return null } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(readMode())
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!hasSupabase)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [data, setData] = useState<Data>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const effectiveMode: Mode | null = mode === 'demo' ? 'demo' : session ? 'live' : null
  const adapter: Adapter | null = useMemo(() => (effectiveMode === 'demo' ? demoAdapter() : effectiveMode === 'live' ? liveAdapter() : null), [effectiveMode])
  const userId = effectiveMode === 'demo' ? DEMO_USER : session?.user.id ?? null
  const dataRef = useRef(data)
  dataRef.current = data

  const loadAll = useCallback(async () => {
    if (!adapter) return
    setLoading(true)
    try {
      const lists = await Promise.all(TABLES.map((t) => adapter.list(t)))
      setData(Object.fromEntries(TABLES.map((t, i) => [t, lists[i]])) as unknown as Data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [adapter])

  // Profile
  useEffect(() => {
    if (effectiveMode === 'demo') {
      try { setProfile(JSON.parse(localStorage.getItem('axial-demo:profile') ?? 'null') ?? demoProfile()) } catch { setProfile(demoProfile()) }
    } else if (effectiveMode === 'live' && supabase && session) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data, error }) => {
        if (error) setError(error.message)
        else setProfile(data as Profile)
      })
    } else setProfile(null)
  }, [effectiveMode, session])

  useEffect(() => { loadAll() }, [loadAll])

  // Automations: deterministic rule evaluation; reminders run on the server in live mode.
  const automate = useCallback(async () => {
    const d = dataRef.current
    if (!adapter || !profile || !userId) return
    const today = new Date()
    const outcomes = evaluateRules(d.rules.filter((r) => !r.space_id), {
      today, currency: profile.currency, startDay: profile.budget_start_day, transactions: d.transactions, budgets: d.budgets,
      subscriptions: d.subscriptions, prices: d.subscription_prices, vaults: d.vaults, entries: d.vault_entries,
    })
    const known = new Set(d.rule_events.map((e) => `${e.rule_id}|${e.period_key}`))
    const fresh = outcomes.filter((o) => !known.has(`${o.rule_id}|${o.period_key}`))
    const notes: Partial<Row<'notifications'>>[] = []
    if (fresh.length) {
      await adapter.insert('rule_events', fresh.map((o) => ({ ...o, user_id: userId })), 'rule_id,period_key')
      for (const o of fresh) {
        const rule = d.rules.find((r) => r.id === o.rule_id)
        if (rule?.notify_in_app && o.outcome !== 'ok') notes.push({ user_id: userId, kind: rule.type === 'subscription_price_increase' ? 'price' : 'rule', title: rule.name, body: o.message, link: '/app/rules', dedupe_key: `rule:${o.rule_id}:${o.period_key}`, email_status: rule.notify_email ? 'pending' : 'skipped' })
      }
    }
    if (effectiveMode === 'demo') {
      const t = iso(today)
      for (const s of d.subscriptions) {
        const next = rollForward(s.next_billing_date, s.frequency, t)
        if (s.status === 'active' && next !== s.next_billing_date) await adapter.update('subscriptions', { id: s.id }, { next_billing_date: next })
        for (const r of remindersDueToday(s, t)) {
          notes.push({ user_id: userId, kind: 'reminder', title: r.offset === 0 ? `${s.name} renews today` : r.offset === 1 ? `${s.name} renews tomorrow` : `${s.name} renews in ${r.offset} days`, body: `${s.currency} ${s.amount.toLocaleString()} on ${r.billing}${s.payment_source ? ` from ${s.payment_source}` : ''}. Axial does not charge or cancel this for you.`, link: '/app/subscriptions', dedupe_key: reminderKey(s.id, r.billing, r.offset), email_status: 'skipped' })
        }
      }
    }
    const existing = new Set(d.notifications.map((n) => n.dedupe_key))
    const newNotes = notes.filter((n) => !existing.has(n.dedupe_key!))
    if (newNotes.length) await adapter.insert('notifications', newNotes, 'user_id,dedupe_key')
    if (effectiveMode === 'live') await adapter.rpc('refresh_badges', {}).catch(() => null)
    if (fresh.length || newNotes.length) {
      const [re, no, su, ba] = await Promise.all([adapter.list('rule_events'), adapter.list('notifications'), adapter.list('subscriptions'), adapter.list('badges')])
      setData((prev) => ({ ...prev, rule_events: re, notifications: no, subscriptions: su, badges: ba }))
      if (profile.notify_push && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        newNotes.slice(0, 3).forEach((n) => new Notification(n.title!, { body: n.body, icon: '/app-icon.svg' }))
      }
    }
  }, [adapter, profile, userId, effectiveMode])

  const [tick, setTick] = useState(0)
  useEffect(() => { if (!loading && profile && adapter) automate().catch((e) => console.error('automations', e)) }, [tick, loading, profile, adapter, automate])

  const refreshTables = useCallback(async (tables: TableName[]) => {
    if (!adapter) return
    const lists = await Promise.all(tables.map((t) => adapter.list(t)))
    setData((prev) => ({ ...prev, ...Object.fromEntries(tables.map((t, i) => [t, lists[i]])) }))
    setTick((x) => x + 1)
  }, [adapter])

  const related: Partial<Record<TableName, TableName[]>> = { space_expenses: ['space_activity'], spaces: ['space_members', 'space_activity'], vaults: ['vault_entries'], subscriptions: ['subscription_prices'], rules: ['rule_events'] }

  const value: Ctx = {
    ready: authReady,
    mode: effectiveMode,
    session,
    userId,
    profile,
    data,
    loading,
    error,
    startDemo(who) {
      try { localStorage.setItem(MODE_KEY, 'demo') } catch { /* ignore */ }
      const stored = readDemoProfile()
      // A "sign-up" with a new email gets a fresh sample workspace in that person's name.
      if (!stored || (who && (stored.email ?? '').toLowerCase() !== who.email.toLowerCase())) seedDemo(who)
      const p = readDemoProfile() ?? demoProfile()
      setProfile(p)
      setMode('demo')
      if (mode === 'demo') loadAll()
    },
    resetDemo() { const p = readDemoProfile(); seedDemo(p?.email && p.email !== demoProfile().email ? { full_name: p.full_name ?? 'You', email: p.email } : undefined); loadAll(); setProfile(readDemoProfile() ?? demoProfile()) },
    async signOut() {
      if (effectiveMode === 'demo') { try { localStorage.removeItem(MODE_KEY) } catch { /* ignore */ } setMode(null) }
      else await supabase?.auth.signOut()
      setData(empty())
    },
    async saveProfile(p) {
      if (!profile) return
      const next = { ...profile, ...p }
      if (effectiveMode === 'demo') localStorage.setItem('axial-demo:profile', JSON.stringify(next))
      else {
        const { error } = await supabase!.from('profiles').update(p).eq('id', profile.id)
        if (error) throw new Error(error.message)
      }
      setProfile(next)
      setTick((x) => x + 1)
    },
    reload: loadAll,
    async insert(t, rows, onConflict) {
      const withUser = rows.map((r) => (t === 'space_members' || t === 'spaces' || t === 'badges' ? r : { user_id: userId, ...r })) as typeof rows
      const res = await adapter!.insert(t, withUser, onConflict)
      await refreshTables([t, ...(related[t] ?? [])])
      return res
    },
    async update(t, match, patch) { await adapter!.update(t, match, patch); await refreshTables([t, ...(related[t] ?? [])]) },
    async remove(t, match) { await adapter!.remove(t, match); await refreshTables([t, ...(related[t] ?? [])]) },
    async rpc(fn, args) {
      const r = await adapter!.rpc(fn, args)
      await refreshTables(['spaces', 'space_members', 'space_expenses', 'space_activity', 'space_invites', 'notifications'])
      return r as never
    },
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
