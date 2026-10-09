import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { budgetUsage } from '@/domain/finance'
import type { Budget } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, errMsg, toast } from '@/ui/kit'
import { useCategories, useMoney } from '@/ui/hooks'
import { date } from '@/ui/format'

const schema = z.object({
  category: z.string().min(1),
  amount: z.coerce.number().positive('Enter a planned amount'),
  period: z.enum(['monthly', 'custom']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  warn_at_pct: z.coerce.number().int().min(1).max(100),
}).refine((v) => v.period === 'monthly' || (v.start_date && v.end_date && v.end_date >= v.start_date), { message: 'Pick a start and end date', path: ['end_date'] })

export default function Budgets() {
  const { data, profile, remove } = useApp()
  const { fmt, currency } = useMoney()
  const [editing, setEditing] = useState<Budget | null | undefined>(undefined)
  const today = new Date()
  const list = data.budgets.filter((b) => !b.space_id).map((b) => ({ b, u: budgetUsage(b, data.transactions, today, currency, profile?.budget_start_day) }))
  const planned = list.reduce((a, x) => a + x.b.amount, 0)
  const spent = list.reduce((a, x) => a + x.u.spent, 0)
  return (
    <>
      <PageHeader title="Budgets" sub="Plan what you'll spend per category, and see recorded spending against it." actions={<Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New budget</Button>} />
      {list.length > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[13px] text-muted">Planned vs recorded</p><p className="num mt-1 font-display text-2xl font-semibold">{fmt(spent)} <span className="text-base font-medium text-muted">of {fmt(planned)}</span></p></div><Badge tone={spent > planned ? 'bad' : spent / planned > 0.8 ? 'warn' : 'good'}>{fmt(planned - spent)} left</Badge></div>
          <Progress className="mt-4 h-2" value={(spent / planned) * 100} tone={spent > planned ? 'bad' : spent / planned > 0.8 ? 'warn' : 'cyan'} />
        </Card>
      )}
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ b, u }) => (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-display font-semibold">{b.category}</h3><p className="text-xs text-muted">{b.period === 'monthly' ? 'Monthly' : `${date(u.range.start, 'd MMM')} – ${date(u.range.end, 'd MMM')}`} · {u.daysLeft} days left</p></div>
                <div className="flex gap-0.5"><button aria-label="Edit budget" className="rounded p-1.5 text-muted hover:bg-sunken" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></button><button aria-label="Delete budget" className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={async () => { try { await remove('budgets', { id: b.id }); toast.ok('Budget deleted') } catch (e) { toast.error(errMsg(e)) } }}><Trash2 className="h-4 w-4" /></button></div>
              </div>
              <p className="num mt-4 font-display text-xl font-semibold">{fmt(u.spent)} <span className="text-sm font-medium text-muted">/ {fmt(b.amount)}</span></p>
              <Progress className="mt-2" value={u.pct} tone={u.status === 'over' ? 'bad' : u.status === 'warn' ? 'warn' : 'cyan'} />
              <div className="mt-3 flex items-center justify-between text-xs">
                {u.status === 'over' ? <Badge tone="bad">Over by {fmt(-u.remaining)}</Badge> : u.status === 'warn' ? <Badge tone="warn">{Math.round(u.pct)}% used</Badge> : <Badge tone="good">On track</Badge>}
                <span className={`num ${u.projected > b.amount && u.status !== 'over' ? 'text-[#94640e] dark:text-warn' : 'text-muted'}`}>Projected {fmt(u.projected)}</span>
              </div>
              {u.projected > b.amount && u.status === 'ok' && <p className="mt-2 text-xs text-muted">At this pace you'll pass this budget before the period ends.</p>}
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon={<Wallet className="h-5 w-5" />} title="No budgets yet" body="Set a monthly amount for categories like Food or Transport and Axial will warn you before you go over." action={<Button onClick={() => setEditing(null)}>Create a budget</Button>} /></Card>}
      <BudgetForm open={editing !== undefined} budget={editing ?? null} onClose={() => setEditing(undefined)} />
    </>
  )
}

export function BudgetForm({ open, budget, onClose, spaceId = null }: { open: boolean; budget: Budget | null; onClose(): void; spaceId?: string | null }) {
  const { insert, update } = useApp()
  const cats = useCategories()
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) })
  useEffect(() => { if (open) reset(budget ? { ...budget, start_date: budget.start_date ?? '', end_date: budget.end_date ?? '' } : { category: 'Food', amount: undefined as never, period: 'monthly', warn_at_pct: 80 }) }, [open, budget, reset])
  const period = watch('period')
  return (
    <Modal open={open} onClose={onClose} title={budget ? 'Edit budget' : 'New budget'}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        const row = { ...v, start_date: v.period === 'custom' ? v.start_date! : null, end_date: v.period === 'custom' ? v.end_date! : null }
        try { if (budget) await update('budgets', { id: budget.id }, row); else await insert('budgets', [{ ...row, space_id: spaceId }]); toast.ok(budget ? 'Budget updated' : 'Budget created'); onClose() } catch (e) { toast.error(errMsg(e)) }
      })}>
        <Field label="Category"><Select {...register('category')}>{cats.expense.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Planned amount" error={errors.amount?.message}><Input inputMode="decimal" {...register('amount')} /></Field>
        <Field label="Period"><Select {...register('period')}><option value="monthly">Every month</option><option value="custom">Custom dates</option></Select></Field>
        {period === 'custom' && <div className="grid grid-cols-2 gap-3"><Field label="Starts"><Input type="date" {...register('start_date')} /></Field><Field label="Ends" error={errors.end_date?.message}><Input type="date" {...register('end_date')} /></Field></div>}
        <Field label="Warn me at (%)" hint="You'll get an alert when recorded spending reaches this share." error={errors.warn_at_pct?.message}><Input inputMode="numeric" {...register('warn_at_pct')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{budget ? 'Save changes' : 'Create budget'}</Button></div>
      </form>
    </Modal>
  )
}
