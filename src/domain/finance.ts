// Deterministic financial calculations. Every total shown in Axial comes from here.
import {
  addDays, addMonths, addWeeks, addYears, differenceInCalendarDays,
  endOfMonth, format, getISOWeek, getISOWeekYear, isAfter, isBefore, parseISO, startOfMonth, subMonths,
} from 'date-fns'
import type { Budget, Frequency, ISODate, Subscription, Transaction, VaultEntry } from './types'

export const iso = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const day = (s: ISODate): Date => parseISO(s)
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface Range { start: ISODate; end: ISODate }

export const inRange = (date: ISODate, r: Range) => date >= r.start && date <= r.end

/** The budget month containing `today`, honouring a custom start day (1–28). */
export function budgetMonth(today: Date, startDay = 1): Range {
  if (startDay <= 1) return { start: iso(startOfMonth(today)), end: iso(endOfMonth(today)) }
  let start = new Date(today.getFullYear(), today.getMonth(), startDay)
  if (isAfter(start, today)) start = subMonths(start, 1)
  return { start: iso(start), end: iso(addDays(addMonths(start, 1), -1)) }
}

export type RangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'year_to_date'

export function presetRange(preset: RangePreset, today: Date, startDay = 1): Range {
  const current = budgetMonth(today, startDay)
  switch (preset) {
    case 'this_month':
      return current
    case 'last_month':
      return budgetMonth(addDays(day(current.start), -1), startDay)
    case 'last_3_months':
      return { start: budgetMonth(subMonths(day(current.start), 2), startDay).start, end: current.end }
    case 'year_to_date':
      return { start: `${today.getFullYear()}-01-01`, end: iso(today) }
  }
}

/** Length-matched range immediately before `r` (for "vs previous period"). */
export function previousRange(r: Range): Range {
  const len = differenceInCalendarDays(day(r.end), day(r.start))
  const end = addDays(day(r.start), -1)
  return { start: iso(addDays(end, -len)), end: iso(end) }
}

export function totals(tx: Transaction[], r: Range, currency: string) {
  let income = 0
  let expense = 0
  let otherCurrency = 0
  for (const t of tx) {
    if (!inRange(t.occurred_on, r)) continue
    if (t.currency !== currency) { otherCurrency++; continue }
    if (t.kind === 'income') income += t.amount
    else expense += t.amount
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense), otherCurrency }
}

export function spendingByCategory(tx: Transaction[], r: Range, currency: string) {
  const map = new Map<string, number>()
  for (const t of tx) {
    if (t.kind !== 'expense' || t.currency !== currency || !inRange(t.occurred_on, r)) continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
}

export function cashflowByMonth(tx: Transaction[], months: number, today: Date, currency: string) {
  const rows: { key: string; label: string; income: number; expense: number; net: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const m = subMonths(startOfMonth(today), i)
    const r = { start: iso(m), end: iso(endOfMonth(m)) }
    const t = totals(tx, r, currency)
    rows.push({ key: format(m, 'yyyy-MM'), label: format(m, 'MMM'), income: t.income, expense: t.expense, net: t.net })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
const PER_MONTH: Record<Frequency, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }

export const monthlyEquivalent = (amount: number, f: Frequency) => round2(amount * PER_MONTH[f])
export const annualEquivalent = (amount: number, f: Frequency) => round2(amount * PER_MONTH[f] * 12)

export function advanceDate(date: ISODate, f: Frequency): ISODate {
  const d = day(date)
  switch (f) {
    case 'weekly': return iso(addWeeks(d, 1))
    case 'monthly': return iso(addMonths(d, 1))
    case 'quarterly': return iso(addMonths(d, 3))
    case 'yearly': return iso(addYears(d, 1))
  }
}

/** Mirrors the SQL scheduler: billing dates in the past roll forward to the next cycle. */
export function rollForward(date: ISODate, f: Frequency, today: ISODate): ISODate {
  let next = date
  let guard = 0
  while (next < today && guard++ < 1000) next = advanceDate(next, f)
  return next
}

export interface Occurrence { sub: Subscription; date: ISODate }

/** Every billing occurrence of active subscriptions between `from` and `from + days`. */
export function upcomingBillings(subs: Subscription[], from: ISODate, days: number): Occurrence[] {
  const until = iso(addDays(day(from), days))
  const out: Occurrence[] = []
  for (const sub of subs) {
    if (sub.status !== 'active') continue
    let d = rollForward(sub.next_billing_date, sub.frequency, from)
    let guard = 0
    while (d <= until && guard++ < 60) {
      out.push({ sub, date: d })
      d = advanceDate(d, sub.frequency)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.name.localeCompare(b.sub.name))
}

export function subscriptionTotals(subs: Subscription[], currency: string) {
  const active = subs.filter((s) => s.status === 'active')
  const same = active.filter((s) => s.currency === currency)
  const monthly = round2(same.reduce((a, s) => a + monthlyEquivalent(s.amount, s.frequency), 0))
  return {
    monthly,
    annual: round2(monthly * 12),
    active: active.length,
    paused: subs.filter((s) => s.status === 'paused').length,
    cancelled: subs.filter((s) => s.status === 'cancelled').length,
    otherCurrency: active.length - same.length,
  }
}

/** Which reminder offsets (days before billing) fall on `today`. */
export function remindersDueToday(sub: Subscription, today: ISODate): { offset: number; billing: ISODate }[] {
  if (sub.status !== 'active') return []
  const next = rollForward(sub.next_billing_date, sub.frequency, today)
  const gap = differenceInCalendarDays(day(next), day(today))
  return sub.reminder_days.filter((o) => o === gap).map((offset) => ({ offset, billing: next }))
}

export const reminderKey = (subId: string, billing: ISODate, offset: number) => `sub:${subId}:${billing}:${offset}`

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
export function budgetRange(b: Budget, today: Date, startDay = 1): Range {
  if (b.period === 'custom' && b.start_date && b.end_date) return { start: b.start_date, end: b.end_date }
  return budgetMonth(today, startDay)
}

export type BudgetStatus = 'ok' | 'warn' | 'over'

export function budgetUsage(b: Budget, tx: Transaction[], today: Date, currency: string, startDay = 1) {
  const r = budgetRange(b, today, startDay)
  const spent = round2(
    tx.filter((t) => t.kind === 'expense' && t.currency === currency && t.category === b.category && inRange(t.occurred_on, r))
      .reduce((a, t) => a + t.amount, 0),
  )
  const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0
  const status: BudgetStatus = spent > b.amount ? 'over' : pct >= b.warn_at_pct ? 'warn' : 'ok'
  const totalDays = differenceInCalendarDays(day(r.end), day(r.start)) + 1
  const elapsed = Math.min(totalDays, Math.max(1, differenceInCalendarDays(today, day(r.start)) + 1))
  const projected = round2((spent / elapsed) * totalDays)
  return { range: r, spent, remaining: round2(b.amount - spent), pct, status, projected, daysLeft: totalDays - elapsed }
}

// ---------------------------------------------------------------------------
// Vaults
// ---------------------------------------------------------------------------
export const vaultBalance = (entries: VaultEntry[]) =>
  round2(entries.reduce((a, e) => a + (e.kind === 'deposit' ? e.amount : -e.amount), 0))

/**
 * Suggested monthly and weekly contribution to reach the goal by the target date,
 * and an estimated completion date from the last 90 days of recorded contributions.
 */
export function vaultPlan(goal: number, entries: VaultEntry[], targetDate: ISODate | null, today: Date) {
  const balance = vaultBalance(entries)
  const remaining = Math.max(0, round2(goal - balance))
  const progress = goal > 0 ? Math.min(100, (balance / goal) * 100) : 0

  let perMonth: number | null = null
  let perWeek: number | null = null
  let overdue = false
  if (targetDate && remaining > 0) {
    const t = day(targetDate)
    if (isBefore(t, today)) overdue = true
    else {
      const months = Math.max(1, Math.round(differenceInCalendarDays(t, today) / 30.44))
      const weeks = Math.max(1, Math.ceil(differenceInCalendarDays(t, today) / 7))
      perMonth = round2(remaining / months)
      perWeek = round2(remaining / weeks)
    }
  }

  const since = iso(addDays(today, -90))
  const recent = entries.filter((e) => e.occurred_on >= since)
  const net90 = vaultBalance(recent)
  const monthlyPace = round2(net90 / 3)
  let estimate: ISODate | null = null
  if (remaining === 0) estimate = iso(today)
  else if (monthlyPace > 0) estimate = iso(addDays(today, Math.ceil((remaining / monthlyPace) * 30.44)))

  return { balance, remaining, progress, perMonth, perWeek, overdue, monthlyPace, estimate }
}

export const isoWeekKey = (d: Date) => `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
export const monthKey = (d: Date) => format(d, 'yyyy-MM')
