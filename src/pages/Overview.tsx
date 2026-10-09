import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addMonths, parseISO } from 'date-fns'
import { Plus, Workflow, Bell } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { budgetUsage, cashflowByMonth, iso, presetRange, previousRange, spendingByCategory, totals, upcomingBillings, vaultBalance, vaultPlan, type RangePreset } from '@/domain/finance'
import { describeRule } from '@/domain/rules'
import { Badge, Button, Card, Empty, PageHeader, Progress, Select, Stat } from '@/ui/kit'
import { OrbitDial, ServiceLogo } from '@/ui/brand'
import { CAT_COLORS, CHART, useMoney } from '@/ui/hooks'
import { ago, date } from '@/ui/format'
import TxForm from '@/ui/TxForm'

export default function Overview() {
  const { data, profile } = useApp()
  const { fmt, currency } = useMoney()
  const [preset, setPreset] = useState<RangePreset>('this_month')
  const [category, setCategory] = useState('all')
  const [adding, setAdding] = useState(false)
  const today = new Date()
  const t = iso(today)
  const startDay = profile?.budget_start_day ?? 1
  const range = presetRange(preset, today, startDay)
  const tx = useMemo(() => (category === 'all' ? data.transactions : data.transactions.filter((x) => x.category === category)), [data.transactions, category])

  const period = totals(tx, range, currency)
  const prev = totals(tx, previousRange(range), currency)
  const allTime = totals(data.transactions, { start: '1900-01-01', end: t }, currency)
  const personalVaults = data.vaults.filter((v) => !v.space_id && !v.archived)
  const vaultBal = (id: string) => vaultBalance(data.vault_entries.filter((e) => e.vault_id === id))
  const saved = personalVaults.reduce((a, v) => a + vaultBal(v.id), 0)
  const locked = personalVaults.filter((v) => v.protected).reduce((a, v) => a + vaultBal(v.id), 0)
  const available = allTime.net - saved
  const budgets = data.budgets.filter((b) => !b.space_id)
  const usage = budgets.map((b) => ({ b, u: budgetUsage(b, data.transactions, today, currency, startDay) }))
  const budgetLeft = usage.reduce((a, x) => a + x.u.remaining, 0)
  const upcoming = upcomingBillings(data.subscriptions, t, 30)
  const due14 = upcoming.filter((o) => o.date <= iso(new Date(Date.now() + 14 * 864e5)))
  const byCat = spendingByCategory(tx, range, currency)
  const catMax = byCat[0]?.amount ?? 1
  const flow = cashflowByMonth(tx, 6, today, currency)
  const recent = tx.slice().sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)).slice(0, 6)
  const subNames = new Set(data.subscriptions.map((s) => s.name.toLowerCase()))
  const bills = useMemo(() => {
    const last = new Map<string, (typeof data.transactions)[number]>()
    for (const x of data.transactions) if (x.kind === 'expense' && x.is_recurring && !subNames.has(x.description.toLowerCase())) {
      const k = x.description.toLowerCase(); const p = last.get(k); if (!p || p.occurred_on < x.occurred_on) last.set(k, x)
    }
    return [...last.values()].map((x) => ({ x, next: iso(addMonths(parseISO(x.occurred_on), 1)) })).filter((b) => b.next >= t).sort((a, b) => a.next.localeCompare(b.next)).slice(0, 4)
  }, [data.transactions, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = data.notifications.slice(0, 4)
  const activeRules = data.rules.filter((r) => r.active && !r.space_id)
  const change = (a: number, b: number) => (b ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}% vs previous period` : 'No earlier data')

  return (
    <>
      <PageHeader title={`Hello${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`} sub={`Recorded activity for ${date(range.start, 'd MMM')} – ${date(range.end, 'd MMM yyyy')}`}
        actions={<>
          <Select aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} className="h-9 w-auto">
            <option value="this_month">This month</option><option value="last_month">Last month</option><option value="last_3_months">Last 3 months</option><option value="year_to_date">Year to date</option>
          </Select>
          <Select aria-label="Category filter" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto">
            <option value="all">All categories</option>{[...new Set(data.transactions.map((x) => x.category))].sort().map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add transaction</Button>
        </>} />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card className="bg-navy text-snow dark:bg-surface" pad={false}>
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-[13px] text-slate">Available balance</p>
              <p className="num mt-1 font-display text-[40px] font-semibold leading-none tracking-tight">{fmt(available)}</p>
              <p className="mt-2 text-xs text-slate">All recorded income minus expenses and money set aside in vaults. Not a bank balance.</p>
            </div>
            {[
              ['Income', fmt(period.income), change(period.income, prev.income)],
              ['Spending', fmt(period.expense), change(period.expense, prev.expense)],
              ['Total savings', fmt(saved), `${personalVaults.length} vault${personalVaults.length === 1 ? '' : 's'}`],
              ['Protected savings', fmt(locked), 'Tracked in Axial, not a locked deposit'],
            ].map(([l, v, n]) => (
              <div key={l} className="border-t border-white/10 pt-4"><p className="text-[13px] text-slate">{l}</p><p className="num mt-1 font-display text-xl font-semibold">{v}</p><p className="mt-0.5 text-xs text-slate">{n}</p></div>
            ))}
          </div>
          {period.otherCurrency > 0 && <p className="border-t border-white/10 px-6 py-3 text-xs text-slate">{period.otherCurrency} transaction(s) in other currencies are not included in these totals.</p>}
        </Card>

        <Card title="Next 30 days" action={<Link to="/app/subscriptions" className="text-[13px] font-semibold text-cyan-ink hover:underline">Subscriptions</Link>}>
          <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
            <div className="w-full max-w-[240px]"><OrbitDial occurrences={upcoming} today={t} centerLabel="Due in 30 days" centerValue={fmt(upcoming.filter((o) => o.sub.currency === currency).reduce((a, o) => a + o.sub.amount, 0), currency, { compact: true })} /></div>
            <ul className="w-full flex-1 space-y-2.5">
              {due14.slice(0, 5).map((o) => (
                <li key={o.sub.id + o.date} className="flex items-center gap-3">
                  <ServiceLogo serviceKey={o.sub.service_key} name={o.sub.name} size={30} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{o.sub.name}</p><p className="text-xs text-muted">{o.date === t ? 'Today' : date(o.date, 'EEE d MMM')}</p></div>
                  <span className="num text-sm font-semibold">{fmt(o.sub.amount, o.sub.currency)}</span>
                </li>
              ))}
              {due14.length === 0 && <li className="text-sm text-muted">Nothing renews in the next 14 days.</li>}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><Stat label="Remaining budget this month" value={fmt(budgetLeft)} tone={budgetLeft < 0 ? 'bad' : undefined} note={`${usage.filter((x) => x.u.status !== 'ok').length} of ${budgets.length} budgets need attention`} /></Card>
        <Card><Stat label="Net this period" value={fmt(period.net, currency, { sign: true })} tone={period.net < 0 ? 'bad' : 'good'} note={period.net < 0 ? 'Recorded expenses exceed income' : 'Income covers recorded spending'} /></Card>
        <Card><Stat label="Upcoming subscriptions" value={`${due14.length}`} note={`Next 14 days · ${fmt(due14.filter((o) => o.sub.currency === currency).reduce((a, o) => a + o.sub.amount, 0))}`} /></Card>
        <Card><Stat label="Unread alerts" value={`${data.notifications.filter((n) => !n.read_at).length}`} note={<Link to="/app/notifications" className="text-cyan-ink hover:underline">Open notifications</Link>} /></Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card title="Cash flow, last 6 months">
          {flow.some((f) => f.income || f.expense) ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={flow} barGap={3} margin={{ left: -8, right: 4 }}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted))" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="rgb(var(--muted))" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip cursor={{ fill: 'rgb(var(--sunken))' }} contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 10, fontSize: 12 }} formatter={(v: number, n) => [fmt(v), n === 'income' ? 'Income' : 'Spending']} />
                  <Bar dataKey="income" fill={CHART.good} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expense" fill={CHART.navy} className="dark:fill-[#36D6F5]" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No transactions yet" body="Add income and expenses to see your monthly cash flow." />}
          <div className="mt-2 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-good" />Income</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-deep dark:bg-cyan" />Spending</span></div>
        </Card>
        <Card title="Spending by category">
          {byCat.length ? (
            <ul className="space-y-3">
              {byCat.slice(0, 7).map((c, i) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between text-sm"><span>{c.category}</span><span className="num font-semibold">{fmt(c.amount)}</span></div>
                  <div className="h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full" style={{ width: `${(c.amount / catMax) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} /></div>
                </li>
              ))}
            </ul>
          ) : <Empty title="No spending in this period" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Recent transactions" action={<Link to="/app/transactions" className="text-[13px] font-semibold text-cyan-ink hover:underline">All</Link>} className="lg:col-span-2">
          {recent.length ? (
            <ul className="-mx-2 divide-y divide-line">
              {recent.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.description}</p><p className="text-xs text-muted">{x.category} · {date(x.occurred_on, 'd MMM')}{x.source === 'demo' && ' · sample'}</p></div>
                  <span className={`num text-sm font-semibold ${x.kind === 'income' ? 'text-[#1d8a66] dark:text-good' : ''}`}>{fmt(x.kind === 'income' ? x.amount : -x.amount, x.currency, { sign: true })}</span>
                </li>
              ))}
            </ul>
          ) : <Empty title="Nothing recorded yet" action={<Button size="sm" onClick={() => setAdding(true)}>Add your first transaction</Button>} />}
        </Card>
        <Card title="Savings goals" action={<Link to="/app/vaults" className="text-[13px] font-semibold text-cyan-ink hover:underline">Vaults</Link>}>
          {personalVaults.length ? (
            <ul className="space-y-4">
              {personalVaults.slice(0, 4).map((v) => {
                const p = vaultPlan(v.goal_amount, data.vault_entries.filter((e) => e.vault_id === v.id), v.target_date, today)
                return <li key={v.id}><div className="mb-1.5 flex justify-between gap-2 text-sm"><span className="truncate font-medium">{v.name}</span><span className="num text-muted">{Math.round(p.progress)}%</span></div><Progress value={p.progress} tone={p.progress >= 100 ? 'good' : 'cyan'} /><p className="num mt-1 text-xs text-muted">{fmt(p.balance)} of {fmt(v.goal_amount)}</p></li>
              })}
            </ul>
          ) : <Empty title="No goals yet" body="Create a vault for something you're saving towards." />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Upcoming bills">
          {bills.length ? <ul className="space-y-2.5">{bills.map(({ x, next }) => <li key={x.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{x.description}<span className="block text-xs text-muted">Expected {date(next, 'd MMM')} · based on last payment</span></span><span className="num font-semibold">{fmt(x.amount, x.currency)}</span></li>)}</ul>
            : <p className="text-sm text-muted">Mark repeating expenses as recurring to see them here.</p>}
        </Card>
        <Card title="Active rules" action={<Link to="/app/rules" className="text-[13px] font-semibold text-cyan-ink hover:underline">Manage</Link>}>
          {activeRules.length ? <ul className="space-y-2.5">{activeRules.slice(0, 5).map((r) => <li key={r.id} className="flex gap-2.5 text-sm"><Workflow className="mt-0.5 h-4 w-4 shrink-0 text-cyan-ink" /><span><span className="font-medium">{r.name}</span><span className="block text-xs text-muted">{describeRule(r, currency)}</span></span></li>)}</ul>
            : <p className="text-sm text-muted">No rules yet. Rules warn you or plan savings automatically.</p>}
        </Card>
        <Card title="Recent alerts">
          {alerts.length ? <ul className="space-y-2.5">{alerts.map((n) => <li key={n.id} className="flex gap-2.5 text-sm"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted" /><span className="min-w-0"><span className="font-medium">{n.title}</span> {!n.read_at && <Badge tone="cyan">New</Badge>}<span className="block truncate text-xs text-muted">{n.body}</span><span className="text-[11px] text-muted">{ago(n.created_at)}</span></span></li>)}</ul>
            : <p className="text-sm text-muted">You're all caught up.</p>}
        </Card>
      </div>
      <TxForm open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
