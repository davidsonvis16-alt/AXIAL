import { describe, expect, it } from 'vitest'
import { advanceDate, budgetMonth, budgetUsage, monthlyEquivalent, remindersDueToday, rollForward, totals, upcomingBillings, vaultPlan } from './finance'
import { evaluateRule } from './rules'
import { importTransactions, findRecurring } from './csv'
import type { Budget, Rule, Subscription, Transaction } from './types'

const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), user_id: 'u', kind: 'expense', amount: 100, currency: 'KES', category: 'Food', description: 'x', occurred_on: '2026-10-05', notes: null, is_recurring: false, source: 'manual', import_hash: null, created_at: '2026-10-05T00:00:00Z', ...p })
const sub = (p: Partial<Subscription>): Subscription => ({ id: 's1', user_id: 'u', name: 'Spotify', service_key: 'spotify', category: 'Entertainment', amount: 299, currency: 'KES', frequency: 'monthly', next_billing_date: '2026-10-12', payment_source: null, notes: null, status: 'active', reminder_days: [3, 1], manage_url: null, started_on: null, cancelled_on: null, created_at: '', ...p })

describe('finance', () => {
  it('converts billing frequencies to monthly', () => {
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100)
    expect(monthlyEquivalent(300, 'quarterly')).toBe(100)
    expect(monthlyEquivalent(120, 'weekly')).toBe(520)
  })
  it('advances month-end dates safely', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(rollForward('2026-08-15', 'monthly', '2026-10-09')).toBe('2026-10-15')
  })
  it('totals only the main currency', () => {
    const t = totals([tx({ kind: 'income', amount: 1000 }), tx({ amount: 250 }), tx({ amount: 50, currency: 'USD' })], { start: '2026-10-01', end: '2026-10-31' }, 'KES')
    expect(t).toEqual({ income: 1000, expense: 250, net: 750, otherCurrency: 1 })
  })
  it('honours a custom budget start day', () => {
    expect(budgetMonth(new Date(2026, 9, 9), 15)).toEqual({ start: '2026-09-15', end: '2026-10-14' })
  })
  it('flags budgets at the warning threshold', () => {
    const b: Budget = { id: 'b', user_id: 'u', space_id: null, category: 'Food', amount: 1000, period: 'monthly', start_date: null, end_date: null, warn_at_pct: 80, created_at: '' }
    expect(budgetUsage(b, [tx({ amount: 850 })], new Date(2026, 9, 9), 'KES').status).toBe('warn')
    expect(budgetUsage(b, [tx({ amount: 1001 })], new Date(2026, 9, 9), 'KES').status).toBe('over')
  })
  it('lists weekly renewals multiple times', () => {
    expect(upcomingBillings([sub({ frequency: 'weekly', next_billing_date: '2026-10-10' })], '2026-10-09', 14).length).toBe(2)
  })
  it('fires reminders on the right day only', () => {
    expect(remindersDueToday(sub({}), '2026-10-09')).toEqual([{ offset: 3, billing: '2026-10-12' }])
    expect(remindersDueToday(sub({}), '2026-10-10')).toEqual([])
    expect(remindersDueToday(sub({ status: 'paused' }), '2026-10-09')).toEqual([])
  })
  it('plans vault contributions', () => {
    const p = vaultPlan(10000, [{ id: 'e', vault_id: 'v', user_id: 'u', kind: 'deposit', amount: 4000, occurred_on: '2026-09-20', note: null, created_at: '' }], '2027-01-09', new Date(2026, 9, 9))
    expect(p.remaining).toBe(6000)
    expect(p.perMonth).toBe(2000)
  })
})

describe('rules', () => {
  const ctx = { today: new Date(2026, 9, 9), currency: 'KES', startDay: 1, transactions: [tx({ kind: 'income', amount: 10000, id: 'i1' }), tx({ category: 'Entertainment', amount: 4500 })], budgets: [], subscriptions: [], prices: [], vaults: [], entries: [] }
  const rule = (p: Partial<Rule>): Rule => ({ id: 'r', user_id: 'u', space_id: null, name: 'r', description: '', type: 'category_limit', threshold: 5000, category: 'Entertainment', vault_id: null, frequency: 'monthly', notify_in_app: true, notify_email: false, active: true, created_at: '', ...p })
  it('records an intended allocation per income', () => {
    const o = evaluateRule(rule({ type: 'save_percent_of_income', threshold: 20 }), ctx)
    expect(o).toHaveLength(1)
    expect(o[0]).toMatchObject({ outcome: 'allocation', amount: 2000, period_key: 'tx:i1' })
  })
  it('warns near a category limit, once per month', () => {
    const o = evaluateRule(rule({}), ctx)
    expect(o).toEqual([expect.objectContaining({ outcome: 'warning', period_key: '2026-10:near' })])
  })
  it('does nothing when paused', () => expect(evaluateRule(rule({ active: false }), ctx)).toEqual([]))
})

describe('csv', () => {
  it('imports debit/credit statements and skips duplicates', () => {
    const csv = 'Date,Details,Withdrawn,Paid In\n05/10/2026,"Naivas, Westlands",1200,\n06/10/2026,Salary,,50000\n05/10/2026,"Naivas, Westlands",1200,'
    const r = importTransactions(csv, new Set())
    expect(r.rows).toHaveLength(2)
    expect(r.duplicates).toBe(1)
    expect(r.rows[0]).toMatchObject({ occurred_on: '2026-10-05', kind: 'expense', amount: 1200 })
  })
  it('detects monthly repeating charges', () => {
    const list = ['2026-07-03', '2026-08-03', '2026-09-03'].map((d) => tx({ description: 'APPLE.COM BILL', amount: 499, occurred_on: d }))
    expect(findRecurring(list, [])[0]).toMatchObject({ frequency: 'monthly', count: 3 })
  })
})
