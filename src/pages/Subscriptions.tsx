import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarClock, ExternalLink, Pause, Pencil, Play, Plus, Trash2, XCircle } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { iso, monthlyEquivalent, subscriptionTotals, upcomingBillings } from '@/domain/finance'
import { SERVICES, SUB_CATEGORIES, serviceByKey } from '@/domain/catalog'
import { findRecurring } from '@/domain/csv'
import type { Frequency, Subscription } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, Textarea, errMsg, toast } from '@/ui/kit'
import { OrbitDial, ServiceLogo } from '@/ui/brand'
import { CAT_COLORS, todayISO, useMoney } from '@/ui/hooks'
import { ago, date } from '@/ui/format'

const FREQ: Record<Frequency, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' }
const REMINDERS = [7, 3, 1, 0]
const remLabel = (d: number) => (d === 0 ? 'On the day' : `${d} day${d > 1 ? 's' : ''} before`)

export default function Subscriptions() {
  const { data, update, remove } = useApp()
  const { fmt, currency } = useMoney()
  const [tab, setTab] = useState<'active' | 'paused' | 'cancelled'>('active')
  const [editing, setEditing] = useState<Subscription | null | undefined>(undefined)
  const [prefill, setPrefill] = useState<Partial<Subscription> | null>(null)
  const [detail, setDetail] = useState<Subscription | null>(null)
  const [cancelling, setCancelling] = useState<Subscription | null>(null)
  const t = todayISO()
  const subs = data.subscriptions
  const totals = subscriptionTotals(subs, currency)
  const upcoming = upcomingBillings(subs, t, 30)
  const dueToday = upcoming.filter((o) => o.date === t)
  const increases = data.subscription_prices.filter((p) => p.previous_amount != null && p.amount > p.previous_amount).sort((a, b) => b.effective_on.localeCompare(a.effective_on))
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    subs.filter((s) => s.status === 'active' && s.currency === currency).forEach((s) => m.set(s.category, (m.get(s.category) ?? 0) + monthlyEquivalent(s.amount, s.frequency)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [subs, currency])
  const found = useMemo(() => findRecurring(data.transactions, subs.map((s) => s.name)), [data.transactions, subs])
  const list = subs.filter((s) => s.status === tab).sort((a, b) => a.next_billing_date.localeCompare(b.next_billing_date))
  const grouped = useMemo(() => { const m = new Map<string, typeof upcoming>(); upcoming.forEach((o) => m.set(o.date, [...(m.get(o.date) ?? []), o])); return [...m.entries()] }, [upcoming])

  return (
    <>
      <PageHeader title="Subscriptions" sub="Every recurring service in one place, with reminders before each renewal." actions={<Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => { setPrefill(null); setEditing(null) }}>Add subscription</Button>} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="flex flex-col items-center">
          <OrbitDial occurrences={upcoming} today={t} centerLabel="Recurring per month" centerValue={fmt(totals.monthly, currency, { compact: true })} size={340} onSelect={(o) => setDetail(o.sub)} />
          <div className="mt-3 grid w-full grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <div><p className="num font-display text-lg font-semibold">{fmt(totals.annual, currency, { compact: true })}</p><p className="text-xs text-muted">Per year</p></div>
            <div><p className="num font-display text-lg font-semibold">{totals.active}</p><p className="text-xs text-muted">Active</p></div>
            <div><p className="num font-display text-lg font-semibold">{dueToday.length}</p><p className="text-xs text-muted">Due today</p></div>
          </div>
          {totals.otherCurrency > 0 && <p className="mt-3 text-xs text-muted">{totals.otherCurrency} subscription(s) billed in another currency aren't in these totals.</p>}
        </Card>

        <Card title="Payment calendar, next 30 days" pad>
          {grouped.length ? (
            <ol className="max-h-[420px] space-y-4 overflow-auto pr-1">
              {grouped.map(([d, occ]) => (
                <li key={d} className="grid grid-cols-[64px_1fr] gap-3">
                  <div className="pt-1 text-right"><p className="font-display text-lg font-semibold leading-none">{date(d, 'd')}</p><p className="text-xs text-muted">{d === t ? 'Today' : date(d, 'EEE MMM')}</p></div>
                  <ul className="space-y-2 border-l border-line pl-4">
                    {occ.map((o) => (
                      <li key={o.sub.id + d}><button onClick={() => setDetail(o.sub)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-sunken">
                        <ServiceLogo serviceKey={o.sub.service_key} name={o.sub.name} size={32} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{o.sub.name}</span><span className="block text-xs text-muted">{o.sub.payment_source ?? 'Payment method not set'}</span></span>
                        <span className="num text-sm font-semibold">{fmt(o.sub.amount, o.sub.currency)}</span>
                      </button></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          ) : <Empty icon={<CalendarClock className="h-5 w-5" />} title="Nothing renews in the next 30 days" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Price increases">
          {increases.length ? (
            <ul className="space-y-3">{increases.slice(0, 5).map((p) => { const s = subs.find((x) => x.id === p.subscription_id); if (!s) return null; return (
              <li key={p.id} className="flex items-center gap-3"><ServiceLogo serviceKey={s.service_key} name={s.name} size={30} /><span className="min-w-0 flex-1 text-sm"><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">Changed {date(p.effective_on)}</span></span><span className="num text-right text-sm"><span className="text-muted line-through">{fmt(p.previous_amount!, s.currency)}</span> <b className="text-[#c23d48] dark:text-bad">{fmt(p.amount, s.currency)}</b></span></li>) })}</ul>
          ) : <p className="text-sm text-muted">No recorded price changes. When you update a subscription's amount, Axial keeps the history here.</p>}
        </Card>
        <Card title="Monthly cost by category">
          {byCat.length ? <ul className="space-y-3">{byCat.map(([c, v], i) => <li key={c}><div className="mb-1 flex justify-between text-sm"><span>{c}</span><span className="num font-semibold">{fmt(v)}</span></div><div className="h-1.5 rounded-full bg-sunken"><div className="h-full rounded-full" style={{ width: `${(v / byCat[0][1]) * 100}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} /></div></li>)}</ul> : <p className="text-sm text-muted">Add subscriptions to see where recurring money goes.</p>}
        </Card>
      </div>

      {found.length > 0 && (
        <Card className="mt-4" title="Repeating charges in your transactions">
          <p className="-mt-2 mb-3 text-[13px] text-muted">These expenses repeat at a regular interval. Add any that are subscriptions so you get reminders.</p>
          <ul className="divide-y divide-line">{found.slice(0, 6).map((f) => (
            <li key={f.description} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><b className="font-medium">{f.description}</b><span className="block text-xs text-muted">{f.count} payments · {f.frequency} · last {date(f.last)}</span></span>
              <span className="flex items-center gap-3"><span className="num font-semibold">{fmt(f.amount)}</span><Button size="sm" variant="secondary" onClick={() => { setPrefill({ name: f.description, amount: f.amount, frequency: f.frequency, next_billing_date: iso(new Date(Date.parse(f.last) + (f.frequency === 'weekly' ? 7 : 30) * 864e5)) }); setEditing(null) }}>Track</Button></span></li>
          ))}</ul>
        </Card>
      )}

      <Card className="mt-4" pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3"><h2 className="font-display text-[15px] font-semibold">All subscriptions</h2>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: `Active ${totals.active}` }, { value: 'paused', label: `Paused ${totals.paused}` }, { value: 'cancelled', label: `Cancelled ${totals.cancelled}` }]} /></div>
        {list.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {list.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setDetail(s)}>
                  <ServiceLogo serviceKey={s.service_key} name={s.name} />
                  <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="block text-xs text-muted">{FREQ[s.frequency]} · {s.status === 'active' ? `Next ${date(s.next_billing_date, 'd MMM')}` : s.status === 'paused' ? 'Paused — no reminders' : `Cancelled${s.cancelled_on ? ` ${date(s.cancelled_on, 'd MMM')}` : ''}`}{s.payment_source && ` · ${s.payment_source}`}</span></span>
                </button>
                <span className="text-right"><span className="num block font-semibold">{fmt(s.amount, s.currency)}</span>{s.frequency !== 'monthly' && <span className="num block text-xs text-muted">{fmt(monthlyEquivalent(s.amount, s.frequency), s.currency)}/mo</span>}</span>
                <span className="flex gap-0.5">
                  <button aria-label={`Edit ${s.name}`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-ink" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
                  {s.status !== 'cancelled' && <button aria-label={s.status === 'active' ? `Pause ${s.name}` : `Resume ${s.name}`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-ink" onClick={async () => { try { await update('subscriptions', { id: s.id }, { status: s.status === 'active' ? 'paused' : 'active' }); toast.ok(s.status === 'active' ? `${s.name} paused in Axial` : `${s.name} resumed`) } catch (e) { toast.error(errMsg(e)) } }}>{s.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>}
                  {s.status !== 'cancelled' && <button aria-label={`Mark ${s.name} cancelled`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={() => setCancelling(s)}><XCircle className="h-4 w-4" /></button>}
                  {s.status === 'cancelled' && <button aria-label={`Delete ${s.name}`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={async () => { try { await remove('subscriptions', { id: s.id }); toast.ok('Removed') } catch (e) { toast.error(errMsg(e)) } }}><Trash2 className="h-4 w-4" /></button>}
                </span>
              </li>
            ))}
          </ul>
        ) : <Empty title={tab === 'active' ? 'No active subscriptions' : `No ${tab} subscriptions`} body={tab === 'active' ? 'Add Spotify, Netflix, your gym or anything else you pay for regularly.' : undefined} action={tab === 'active' && <Button onClick={() => setEditing(null)}>Add subscription</Button>} />}
      </Card>

      <SubForm open={editing !== undefined} sub={editing ?? null} prefill={prefill} onClose={() => { setEditing(undefined); setPrefill(null) }} />
      <SubDetail sub={detail} onClose={() => setDetail(null)} onEdit={(s) => { setDetail(null); setEditing(s) }} />
      <CancelFlow sub={cancelling} onClose={() => setCancelling(null)} />
    </>
  )
}

function CancelFlow({ sub, onClose }: { sub: Subscription | null; onClose(): void }) {
  const { update } = useApp()
  if (!sub) return null
  const svc = serviceByKey(sub.service_key)
  const link = sub.manage_url || svc?.manage
  return (
    <Modal open onClose={onClose} title={`Cancel ${sub.name}`}>
      <div className="space-y-4 text-sm">
        <p>Axial can't cancel subscriptions for you. Cancel with {sub.name} first, then mark it cancelled here so reminders stop.</p>
        {svc?.how && <p className="rounded-lg bg-sunken px-3 py-2.5 text-[13px]"><b>How:</b> {svc.how}</p>}
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-cyan-ink hover:underline">Open {sub.name} subscription settings <ExternalLink className="h-3.5 w-3.5" /></a>}
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Not yet</Button><Button variant="danger" onClick={async () => { try { await update('subscriptions', { id: sub.id }, { status: 'cancelled', cancelled_on: todayISO() }); toast.ok(`${sub.name} marked as cancelled`); onClose() } catch (e) { toast.error(errMsg(e)) } }}>I've cancelled it</Button></div>
      </div>
    </Modal>
  )
}

function SubDetail({ sub, onClose, onEdit }: { sub: Subscription | null; onClose(): void; onEdit(s: Subscription): void }) {
  const { data } = useApp()
  const { fmt } = useMoney()
  if (!sub) return null
  const s = data.subscriptions.find((x) => x.id === sub.id) ?? sub
  const svc = serviceByKey(s.service_key)
  const prices = data.subscription_prices.filter((p) => p.subscription_id === s.id).sort((a, b) => b.effective_on.localeCompare(a.effective_on))
  const reminders = data.notifications.filter((n) => n.dedupe_key.startsWith(`sub:${s.id}:`))
  const link = s.manage_url || svc?.manage
  return (
    <Modal open onClose={onClose} title={s.name} wide>
      <div className="flex items-center gap-4"><ServiceLogo serviceKey={s.service_key} name={s.name} size={52} /><div><p className="num font-display text-2xl font-semibold">{fmt(s.amount, s.currency)} <span className="text-sm font-medium text-muted">{FREQ[s.frequency].toLowerCase()}</span></p><p className="text-sm text-muted">{fmt(monthlyEquivalent(s.amount, s.frequency), s.currency)} a month · {fmt(monthlyEquivalent(s.amount, s.frequency) * 12, s.currency)} a year</p></div></div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        {[['Status', <Badge key="s" tone={s.status === 'active' ? 'good' : s.status === 'paused' ? 'warn' : 'neutral'}>{s.status}</Badge>], ['Next billing', s.status === 'active' ? date(s.next_billing_date) : '—'], ['Payment source', s.payment_source ?? 'Not set'], ['Category', s.category], ['Reminders', s.reminder_days.length ? [...s.reminder_days].sort((a, b) => b - a).map(remLabel).join(', ') : 'Off'], ['Tracking since', s.started_on ? date(s.started_on) : date(s.created_at.slice(0, 10))]].map(([k, v]) => <div key={k as string}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
      </dl>
      {s.notes && <p className="mt-4 rounded-lg bg-sunken px-3 py-2.5 text-sm">{s.notes}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-semibold">Price history</h3>{prices.length ? <ul className="space-y-1.5 text-sm">{prices.map((p) => <li key={p.id} className="flex justify-between"><span className="text-muted">{date(p.effective_on)}</span><span className="num">{p.previous_amount != null && <span className="text-muted">{fmt(p.previous_amount, s.currency)} → </span>}{fmt(p.amount, s.currency)}</span></li>)}</ul> : <p className="text-sm text-muted">No changes recorded.</p>}</div>
        <div><h3 className="mb-2 text-sm font-semibold">Reminder history</h3>{reminders.length ? <ul className="space-y-1.5 text-sm">{reminders.slice(0, 6).map((n) => <li key={n.id} className="flex justify-between gap-2"><span className="truncate">{n.title}</span><span className="shrink-0 text-xs text-muted">{ago(n.created_at)}</span></li>)}</ul> : <p className="text-sm text-muted">No reminders sent yet.</p>}</div>
      </div>
      <div className="mt-5 rounded-xl border border-line p-4 text-sm"><h3 className="font-semibold">Manage or cancel</h3><p className="mt-1 text-muted">{svc?.how ?? 'Manage this subscription with the provider directly.'}</p>{link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-cyan-ink hover:underline">Open official page <ExternalLink className="h-3.5 w-3.5" /></a>}<p className="mt-2 text-xs text-muted">Tracking a subscription in Axial doesn't change or cancel it.</p></div>
      <div className="mt-5 flex justify-end"><Button onClick={() => onEdit(s)} icon={<Pencil className="h-4 w-4" />}>Edit</Button></div>
    </Modal>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name the service').max(60),
  service_key: z.string().optional(),
  category: z.string(),
  amount: z.coerce.number().min(0, 'Enter the amount').max(1e9),
  currency: z.string().length(3),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the next billing date'),
  payment_source: z.string().max(60).optional(),
  manage_url: z.string().url('Enter a full link starting with https://').or(z.literal('')).optional(),
  notes: z.string().max(500).optional(),
  reminder_days: z.array(z.number()),
})
type V = z.infer<typeof schema>

function SubForm({ open, sub, prefill, onClose }: { open: boolean; sub: Subscription | null; prefill: Partial<Subscription> | null; onClose(): void }) {
  const { insert, update, profile } = useApp()
  const { currency } = useMoney()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    const base = sub ?? { name: '', service_key: '', category: 'Entertainment', amount: undefined, currency, frequency: 'monthly', next_billing_date: todayISO(), payment_source: '', manage_url: '', notes: '', reminder_days: profile?.reminder_defaults ?? [3, 1], ...prefill }
    reset({ ...base, service_key: base.service_key ?? '', payment_source: base.payment_source ?? '', manage_url: base.manage_url ?? '', notes: base.notes ?? '' } as V)
  }, [open, sub, prefill, reset, currency, profile?.reminder_defaults])
  const key = watch('service_key')
  const rem = watch('reminder_days') ?? []
  return (
    <Modal open={open} onClose={onClose} title={sub ? `Edit ${sub.name}` : 'Add subscription'} wide>
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        const row = { ...v, service_key: v.service_key || null, payment_source: v.payment_source || null, manage_url: v.manage_url || null, notes: v.notes || null, currency: v.currency.toUpperCase() }
        try {
          if (sub) {
            await update('subscriptions', { id: sub.id }, row)
            if (row.amount !== sub.amount) await insert('subscription_prices', [{ subscription_id: sub.id, amount: row.amount, previous_amount: sub.amount, effective_on: todayISO() }])
          } else {
            const [created] = await insert('subscriptions', [{ ...row, status: 'active', started_on: todayISO() }])
            if (created) await insert('subscription_prices', [{ subscription_id: created.id, amount: row.amount, previous_amount: null, effective_on: todayISO() }])
          }
          toast.ok(sub ? 'Subscription updated' : `${row.name} added`)
          onClose()
        } catch (e) { toast.error(errMsg(e)) }
      })}>
        {!sub && (
          <div><p className="mb-2 text-[13px] font-semibold">Quick pick</p>
            <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {SERVICES.map((s) => (
                <button type="button" key={s.key} onClick={() => { setValue('service_key', s.key); setValue('name', s.name); setValue('category', s.category); setValue('manage_url', s.manage) }}
                  className={`flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] font-medium ${key === s.key ? 'border-cyan bg-cyan/10' : 'border-line hover:bg-sunken'}`}>
                  <ServiceLogo serviceKey={s.key} name={s.name} size={32} /><span className="line-clamp-2 text-center leading-tight">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service name" error={errors.name?.message}><Input {...register('name')} /></Field>
          <Field label="Category"><Select {...register('category')}>{SUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-[1fr_88px] gap-3 sm:grid-cols-[1fr_88px_1fr]">
          <Field label="Amount" error={errors.amount?.message}><Input inputMode="decimal" {...register('amount')} /></Field>
          <Field label="Currency"><Input maxLength={3} className="uppercase" {...register('currency')} /></Field>
          <Field label="Billed" className="col-span-2 sm:col-span-1"><Select {...register('frequency')}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Next billing date" error={errors.next_billing_date?.message}><Input type="date" {...register('next_billing_date')} /></Field>
          <Field label="Paid from" hint="e.g. M-Pesa, Visa •• 4821"><Input {...register('payment_source')} /></Field>
        </div>
        <fieldset><legend className="mb-2 text-[13px] font-semibold">Remind me</legend>
          <div className="flex flex-wrap gap-2">{REMINDERS.map((d) => { const on = rem.includes(d); return <button type="button" key={d} aria-pressed={on} onClick={() => setValue('reminder_days', on ? rem.filter((x) => x !== d) : [...rem, d])} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? 'border-cyan bg-cyan/15 text-ink' : 'border-line text-muted hover:bg-sunken'}`}>{remLabel(d)}</button> })}</div>
        </fieldset>
        <Field label="Manage or cancel link" error={errors.manage_url?.message}><Input placeholder="https://" {...register('manage_url')} /></Field>
        <Field label="Notes"><Textarea {...register('notes')} placeholder="e.g. Shared family plan, split with Brian" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{sub ? 'Save changes' : 'Add subscription'}</Button></div>
      </form>
    </Modal>
  )
}

