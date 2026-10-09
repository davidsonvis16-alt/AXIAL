// Rule-evaluation service. Pure and deterministic: given stored records it returns
// outcomes. Axial never moves or blocks real money — outcomes are either warnings
// (tracking) or intended allocations (recorded inside Axial only).
import type { Budget, Rule, RuleType, Subscription, SubscriptionPrice, Transaction, Vault, VaultEntry } from './types'
import { budgetMonth, budgetUsage, inRange, isoWeekKey, monthKey, monthlyEquivalent, round2 } from './finance'

export interface RuleContext {
  today: Date
  currency: string
  startDay: number
  transactions: Transaction[]
  budgets: Budget[]
  subscriptions: Subscription[]
  prices: SubscriptionPrice[]
  vaults: Vault[]
  entries: VaultEntry[]
}

export interface RuleOutcome {
  rule_id: string
  period_key: string
  outcome: 'warning' | 'allocation' | 'info' | 'ok'
  message: string
  amount: number | null
}

export const RULE_TYPES: Record<RuleType, { label: string; effect: 'Warns you' | 'Records an intended saving' | 'Requires approval'; needs: ('threshold' | 'category' | 'vault')[]; unit?: '%' | 'money' }> = {
  save_percent_of_income: { label: 'Save a percentage of every income', effect: 'Records an intended saving', needs: ['threshold', 'vault'], unit: '%' },
  category_limit: { label: 'Limit spending in a category', effect: 'Warns you', needs: ['threshold', 'category'], unit: 'money' },
  budget_threshold: { label: 'Warn when a budget reaches a percentage', effect: 'Warns you', needs: ['threshold'], unit: '%' },
  scheduled_saving: { label: 'Set aside an amount every week', effect: 'Records an intended saving', needs: ['threshold', 'vault'], unit: 'money' },
  subscription_price_increase: { label: 'Alert me when a subscription price goes up', effect: 'Warns you', needs: [] },
  recurring_cap: { label: 'Cap total recurring expenses per month', effect: 'Warns you', needs: ['threshold'], unit: 'money' },
  shared_approval: { label: 'Shared expenses above an amount need approval', effect: 'Requires approval', needs: ['threshold'], unit: 'money' },
  protect_savings: { label: 'Flag withdrawals from protected vaults', effect: 'Warns you', needs: [] },
}

const fmt = (n: number, c: string) => `${c} ${n.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`

export function evaluateRule(rule: Rule, ctx: RuleContext): RuleOutcome[] {
  if (!rule.active) return []
  const out: RuleOutcome[] = []
  const month = budgetMonth(ctx.today, ctx.startDay)
  const mk = monthKey(ctx.today)
  const t = rule.threshold ?? 0
  const push = (period_key: string, outcome: RuleOutcome['outcome'], message: string, amount: number | null = null) =>
    out.push({ rule_id: rule.id, period_key, outcome, message, amount })
  const own = ctx.transactions.filter((x) => x.currency === ctx.currency)

  switch (rule.type) {
    case 'save_percent_of_income': {
      const vault = ctx.vaults.find((v) => v.id === rule.vault_id)
      for (const tx of own.filter((x) => x.kind === 'income' && inRange(x.occurred_on, month))) {
        const amt = round2((tx.amount * t) / 100)
        push(`tx:${tx.id}`, 'allocation', `Set aside ${fmt(amt, ctx.currency)} (${t}% of "${tx.description}")${vault ? ` for ${vault.name}` : ''}. Record the deposit once you move it.`, amt)
      }
      break
    }
    case 'category_limit': {
      const spent = round2(own.filter((x) => x.kind === 'expense' && x.category === rule.category && inRange(x.occurred_on, month)).reduce((a, x) => a + x.amount, 0))
      if (t > 0 && spent > t) push(`${mk}:over`, 'warning', `${rule.category} spending is ${fmt(spent, ctx.currency)}, over your ${fmt(t, ctx.currency)} limit.`, spent)
      else if (t > 0 && spent >= t * 0.8) push(`${mk}:near`, 'warning', `${rule.category} spending reached ${Math.round((spent / t) * 100)}% of your ${fmt(t, ctx.currency)} limit.`, spent)
      break
    }
    case 'budget_threshold': {
      for (const b of ctx.budgets.filter((b) => !b.space_id)) {
        const u = budgetUsage(b, ctx.transactions, ctx.today, ctx.currency, ctx.startDay)
        if (u.pct >= t) push(`${u.range.start}:${b.id}`, 'warning', `${b.category} budget is at ${Math.round(u.pct)}% (${fmt(u.spent, ctx.currency)} of ${fmt(b.amount, ctx.currency)}).`, u.spent)
      }
      break
    }
    case 'scheduled_saving': {
      const vault = ctx.vaults.find((v) => v.id === rule.vault_id)
      push(isoWeekKey(ctx.today), 'allocation', `Weekly plan: set aside ${fmt(t, ctx.currency)}${vault ? ` for ${vault.name}` : ''}. Record the deposit once you move it.`, t)
      break
    }
    case 'subscription_price_increase': {
      for (const p of ctx.prices) {
        if (p.previous_amount != null && p.amount > p.previous_amount) {
          const sub = ctx.subscriptions.find((s) => s.id === p.subscription_id)
          if (sub) push(`price:${p.id}`, 'warning', `${sub.name} went from ${fmt(p.previous_amount, sub.currency)} to ${fmt(p.amount, sub.currency)}.`, p.amount)
        }
      }
      break
    }
    case 'recurring_cap': {
      const subs = ctx.subscriptions.filter((s) => s.status === 'active' && s.currency === ctx.currency).reduce((a, s) => a + monthlyEquivalent(s.amount, s.frequency), 0)
      const recurringTx = own.filter((x) => x.kind === 'expense' && x.is_recurring && x.category !== 'Subscriptions' && inRange(x.occurred_on, month)).reduce((a, x) => a + x.amount, 0)
      const total = round2(subs + recurringTx)
      if (t > 0 && total > t) push(`${mk}:over`, 'warning', `Recurring expenses are ${fmt(total, ctx.currency)} a month, above your ${fmt(t, ctx.currency)} target.`, total)
      break
    }
    case 'protect_savings': {
      const protectedIds = new Set(ctx.vaults.filter((v) => v.protected).map((v) => v.id))
      for (const e of ctx.entries.filter((e) => e.kind === 'withdrawal' && protectedIds.has(e.vault_id) && inRange(e.occurred_on, month))) {
        const v = ctx.vaults.find((v) => v.id === e.vault_id)!
        push(`wd:${e.id}`, 'warning', `${fmt(e.amount, ctx.currency)} was withdrawn from protected vault "${v.name}".`, e.amount)
      }
      break
    }
    case 'shared_approval':
      break // enforced by the database when shared expenses are added
  }
  return out
}

export const evaluateRules = (rules: Rule[], ctx: RuleContext) => rules.flatMap((r) => evaluateRule(r, ctx))

export function describeRule(r: Pick<Rule, 'type' | 'threshold' | 'category'>, currency: string): string {
  const t = r.threshold ?? 0
  switch (r.type) {
    case 'save_percent_of_income': return `Set aside ${t}% of every income you record`
    case 'category_limit': return `Keep ${r.category ?? 'a category'} under ${fmt(t, currency)} a month`
    case 'budget_threshold': return `Warn me when any budget reaches ${t}%`
    case 'scheduled_saving': return `Set aside ${fmt(t, currency)} every week`
    case 'subscription_price_increase': return 'Tell me when a subscription costs more than before'
    case 'recurring_cap': return `Keep recurring expenses under ${fmt(t, currency)} a month`
    case 'shared_approval': return `Shared expenses of ${fmt(t, currency)} or more need another member's approval`
    case 'protect_savings': return 'Flag any withdrawal from a protected vault'
  }
}
