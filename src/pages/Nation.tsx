import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { subMonths } from 'date-fns'
import { useApp } from '@/data/AppData'
import { iso } from '@/domain/finance'
import { COUNTIES, FINANCING, FISCAL_YEAR, HISTORY, REVENUE, SPENDING, VAT_CATEGORIES, VAT_RATE, sum, type BudgetLine } from '@/domain/publicFinance'
import { Card, PageHeader, Segmented, Stat } from '@/ui/kit'
import { CAT_COLORS, CHART, useMoney } from '@/ui/hooks'

const bn = (n: number) => `KES ${n >= 1000 ? `${(n / 1000).toFixed(2).replace(/\.?0+$/, '')}T` : `${n.toLocaleString()}B`}`

function Lines({ lines, total }: { lines: BudgetLine[]; total: number }) {
  const max = Math.max(...lines.map((l) => l.amount))
  return (
    <ul className="space-y-3.5">
      {lines.map((l, i) => (
        <li key={l.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0"><span className="font-medium">{l.label}</span>{l.note && <span className="block truncate text-xs text-muted">{l.note}</span>}</span>
            <span className="num shrink-0 text-right"><span className="font-semibold">{bn(l.amount)}</span><span className="block text-xs text-muted">{Math.round((l.amount / total) * 100)}%</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full" style={{ width: `${(l.amount / max) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} /></div>
        </li>
      ))}
    </ul>
  )
}

export default function Nation() {
  const { data } = useApp()
  const { fmt, currency } = useMoney()
  const [view, setView] = useState<'spending' | 'revenue'>('spending')
  const revenue = sum(REVENUE), borrowing = sum(FINANCING), spending = sum(SPENDING)
  const interest = SPENDING.find((s) => s.key === 'debt')!.amount

  // Rough VAT estimate on the person's own recorded spending over the last 12 months.
  const since = iso(subMonths(new Date(), 12))
  const vatSpend = data.transactions.filter((t) => t.kind === 'expense' && t.currency === currency && t.occurred_on >= since && VAT_CATEGORIES.includes(t.category)).reduce((a, t) => a + t.amount, 0)
  const vat = (vatSpend * VAT_RATE) / (1 + VAT_RATE)

  return (
    <>
      <PageHeader title="Public finance" sub={`How the national government raises money and where it goes, financial year ${FISCAL_YEAR}.`} />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <Stat label="Revenue raised" value={bn(revenue)} note="Taxes, fees and other income" />
          <Stat label="Total spending" value={bn(spending)} note="National budget" />
          <Stat label="Borrowed to close the gap" value={bn(borrowing)} tone="bad" note={`${Math.round((borrowing / spending) * 100)}% of spending`} />
          <Stat label="Interest on debt" value={`${Math.round((interest / revenue) * 100)}%`} note="of all revenue raised" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card title={view === 'spending' ? 'Where the money goes' : 'Where the money comes from'} action={<Segmented value={view} onChange={setView} options={[{ value: 'spending', label: 'Spending' }, { value: 'revenue', label: 'Revenue' }]} />}>
          {view === 'spending' ? <Lines lines={SPENDING} total={spending} /> : (
            <>
              <Lines lines={REVENUE} total={revenue} />
              <p className="mb-3 mt-6 text-[13px] font-semibold">Plus borrowing</p>
              <Lines lines={FINANCING} total={borrowing} />
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Every KES 100 of revenue">
            <div className="flex h-3 overflow-hidden rounded-full">
              {SPENDING.slice(0, 6).map((s, i) => <div key={s.key} style={{ width: `${(s.amount / spending) * 100}%`, background: CAT_COLORS[i] }} title={s.label} />)}
              <div className="flex-1 bg-sunken" />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {SPENDING.slice(0, 6).map((s, i) => (
                <li key={s.key} className="flex min-w-0 items-center gap-2"><i className="h-2 w-2 shrink-0 rounded-sm" style={{ background: CAT_COLORS[i] }} /><span className="truncate">{s.label.split(' (')[0]}</span><span className="num ml-auto font-semibold">{Math.round((s.amount / spending) * 100)}</span></li>
              ))}
            </ul>
          </Card>

          <Card title="Your share">
            <p className="text-[13px] text-muted">Estimated VAT inside your recorded spending, last 12 months</p>
            <p className="num mt-1 font-display text-2xl font-semibold">{fmt(vat)}</p>
            {vat > 0 ? (
              <ul className="mt-4 space-y-1.5 text-sm">
                {SPENDING.slice(0, 4).map((s) => <li key={s.key} className="flex justify-between gap-3"><span className="text-muted">{s.label.split(' (')[0]}</span><span className="num font-medium">{fmt((vat * s.amount) / spending)}</span></li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Record spending on transport, shopping, utilities or subscriptions to see an estimate.</p>}
            <p className="mt-3 text-xs text-muted">16% VAT on taxable categories; rent and most fresh food are excluded.</p>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card title="Revenue vs spending, last 5 years">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={HISTORY} barGap={3} margin={{ left: -8, right: 4 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={12} stroke="rgb(var(--muted))" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="rgb(var(--muted))" tickFormatter={(v) => `${(v / 1000).toFixed(1)}T`} />
                <Tooltip cursor={{ fill: 'rgb(var(--sunken))' }} contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 10, fontSize: 12 }} formatter={(v: number, n) => [bn(v), n === 'revenue' ? 'Revenue' : 'Spending']} />
                <Bar dataKey="revenue" fill={CHART.good} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="spending" fill={CHART.navy} className="dark:fill-[#36D6F5]" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-good" />Revenue</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-deep dark:bg-cyan" />Spending</span></div>
        </Card>
        <Card title="Largest county allocations">
          <ul className="space-y-2.5">
            {[...COUNTIES].sort((a, b) => b.amount - a.amount).map((c) => (
              <li key={c.name}>
                <div className="mb-1 flex justify-between text-sm"><span>{c.name}</span><span className="num font-semibold">KES {c.amount}B</span></div>
                <div className="h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full bg-cyan" style={{ width: `${(c.amount / COUNTIES[0].amount) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted">Rounded estimates based on published budget estimates. See the National Treasury and Controller of Budget for official figures.</p>
    </>
  )
}
