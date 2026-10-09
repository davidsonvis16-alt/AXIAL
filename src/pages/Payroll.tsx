import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { Briefcase, FileText, Pencil, Plus, Printer, Trash2, Users } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { iso } from '@/domain/finance'
import { payrollLine, payrollTotals, payslip } from '@/domain/payroll'
import type { Employee, PayrollLine, PayrollRun } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, cn, errMsg, toast } from '@/ui/kit'
import { useMoney } from '@/ui/hooks'
import { date } from '@/ui/format'

const METHOD = { mpesa: 'M-Pesa', bank: 'Bank', cash: 'Cash' } as const
const monthLabel = (p: string) => format(parseISO(`${p}-01`), 'MMMM yyyy')

export default function Payroll() {
  const { data, remove } = useApp()
  const { fmt } = useMoney()
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const [viewing, setViewing] = useState<PayrollRun | null>(null)
  const [slip, setSlip] = useState<{ run: PayrollRun; line: PayrollLine } | null>(null)
  const staff = data.employees
  const active = staff.filter((e) => e.active)
  const totals = payrollTotals(active.map(payrollLine))
  const runs = [...data.payroll_runs].sort((a, b) => b.period.localeCompare(a.period))

  return (
    <>
      <PageHeader title="Payroll" sub="Pay your workers each month with PAYE, NSSF, SHIF and housing levy worked out for you."
        actions={<>
          <Button variant="secondary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add worker</Button>
          <Button size="sm" className="h-9" icon={<Briefcase className="h-4 w-4" />} disabled={!active.length} onClick={() => setRunning(true)}>Run payroll</Button>
        </>} />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <Stat label="Active workers" value={active.length} note={`${staff.length - active.length} inactive`} />
          <Stat label="Monthly gross" value={fmt(totals.total_gross)} />
          <Stat label="Take-home pay" value={fmt(totals.total_net)} tone="good" note="Sent to workers" />
          <Stat label="Total cost to you" value={fmt(totals.employer_cost)} note="Incl. employer NSSF & housing levy" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card title="Workers" pad={false}>
          {staff.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {staff.map((e) => {
                const p = payslip(e.gross_salary)
                return (
                  <li key={e.id} className={cn('flex items-center gap-3 px-5 py-3.5', !e.active && 'opacity-60')}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunken font-display text-sm font-semibold">{e.full_name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.full_name} {!e.active && <Badge>Inactive</Badge>}</p>
                      <p className="truncate text-xs text-muted">{e.role || 'No role set'} · {METHOD[e.pay_method]}{e.phone && e.pay_method === 'mpesa' ? ` ${e.phone}` : ''}</p>
                    </div>
                    <div className="num shrink-0 text-right"><p className="text-sm font-semibold">{fmt(p.net)}</p><p className="text-xs text-muted">of {fmt(e.gross_salary)}</p></div>
                    <div className="flex shrink-0 gap-0.5">
                      <button aria-label={`Edit ${e.full_name}`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-ink" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></button>
                      <button aria-label={`Remove ${e.full_name}`} className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={async () => { try { await remove('employees', { id: e.id }); toast.ok(`${e.full_name} removed`) } catch (err) { toast.error(errMsg(err)) } }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : <Empty icon={<Users className="h-5 w-5" />} title="No workers yet" body="Add the people you pay each month with their gross salary and how they get paid." action={<Button onClick={() => setEditing(null)}>Add a worker</Button>} />}
        </Card>

        <Card title="Pay history" pad={false}>
          {runs.length ? (
            <ul className="divide-y divide-line border-t border-line">
              {runs.map((r) => (
                <li key={r.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-sunken/50" onClick={() => setViewing(r)}>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{monthLabel(r.period)}</p><p className="text-xs text-muted">{r.lines.length} worker{r.lines.length === 1 ? '' : 's'} · paid {date(r.paid_on, 'd MMM')}</p></div>
                    <div className="num text-right"><p className="text-sm font-semibold">{fmt(r.total_net)}</p><Badge tone="good">Paid</Badge></div>
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<FileText className="h-5 w-5" />} title="No pay runs yet" body="Run payroll to pay your workers and keep a payslip for each one." />}
        </Card>
      </div>

      <WorkerForm open={editing !== undefined} worker={editing ?? null} onClose={() => setEditing(undefined)} />
      <RunPayroll open={running} onClose={() => setRunning(false)} workers={active} />
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `Payroll — ${monthLabel(viewing.period)}` : ''} wide>
        {viewing && (
          <>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {viewing.lines.map((l) => (
                <li key={l.employee_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{l.full_name}</p><p className="text-xs text-muted">{METHOD[l.pay_method]} · gross {fmt(l.gross)}</p></div>
                  <p className="num text-sm font-semibold">{fmt(l.net)}</p>
                  <Button variant="secondary" size="sm" onClick={() => setSlip({ run: viewing, line: l })}>Payslip</Button>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><Stat label="Gross" value={fmt(viewing.total_gross)} /><Stat label="Paid to workers" value={fmt(viewing.total_net)} /><Stat label="Total cost" value={fmt(viewing.employer_cost)} /></div>
          </>
        )}
      </Modal>
      <Modal open={!!slip} onClose={() => setSlip(null)} title="Payslip">
        {slip && <Payslip run={slip.run} line={slip.line} />}
      </Modal>
    </>
  )
}

function Payslip({ run, line }: { run: PayrollRun; line: PayrollLine }) {
  const { profile } = useApp()
  const { fmt } = useMoney()
  const row = (label: string, v: number, neg = false) => <div className="flex justify-between py-1.5 text-sm"><span className="text-muted">{label}</span><span className="num">{neg ? '− ' : ''}{fmt(v)}</span></div>
  return (
    <>
      <div className="print-area rounded-xl border border-line p-4">
        <div className="flex justify-between gap-3 border-b border-line pb-3">
          <div><p className="font-display font-semibold">{line.full_name}</p><p className="text-xs text-muted">{line.role ?? 'Employee'}</p></div>
          <div className="text-right text-xs text-muted"><p className="font-semibold text-ink">{monthLabel(run.period)}</p><p>Paid {date(run.paid_on)}</p><p>{profile?.full_name}</p></div>
        </div>
        <div className="divide-y divide-line">
          {row('Gross salary', line.gross)}
          {row('PAYE', line.paye, true)}
          {row('NSSF', line.nssf, true)}
          {row('SHIF', line.shif, true)}
          {row('Housing levy', line.housing_levy, true)}
          <div className="flex justify-between pt-3 font-semibold"><span>Net pay</span><span className="num">{fmt(line.net)}</span></div>
        </div>
        <p className="mt-3 text-xs text-muted">Paid by {METHOD[line.pay_method]}. Employer also contributed NSSF {fmt(line.employer_nssf)} and housing levy {fmt(line.employer_housing_levy)}.</p>
      </div>
      <div className="mt-4 flex justify-end"><Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button></div>
    </>
  )
}

function RunPayroll({ open, onClose, workers }: { open: boolean; onClose(): void; workers: Employee[] }) {
  const { data, insert, profile } = useApp()
  const { fmt, currency } = useMoney()
  const [period, setPeriod] = useState(() => iso(new Date()).slice(0, 7))
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setSkip(new Set()); setPeriod(iso(new Date()).slice(0, 7)) } }, [open])
  const lines = useMemo(() => workers.filter((w) => !skip.has(w.id)).map(payrollLine), [workers, skip])
  const t = payrollTotals(lines)
  const done = data.payroll_runs.some((r) => r.period === period)
  const toggle = (id: string) => setSkip((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const pay = async () => {
    setBusy(true)
    try {
      await insert('payroll_runs', [{ period, paid_on: iso(new Date()), lines, total_gross: t.total_gross, total_net: t.total_net, employer_cost: t.employer_cost }])
      await insert('transactions', [{ kind: 'expense', amount: t.employer_cost, currency: profile?.currency ?? currency, category: 'Payroll', description: `Payroll — ${monthLabel(period)}`, occurred_on: iso(new Date()), notes: `${lines.length} workers · net ${t.total_net}, statutory ${t.statutory}`, is_recurring: true, source: 'manual', import_hash: null }])
      toast.ok(`${lines.length} worker${lines.length === 1 ? '' : 's'} paid for ${monthLabel(period)}`)
      onClose()
    } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Run payroll" wide>
      <Field label="Pay period" error={done ? `Payroll for ${monthLabel(period)} has already been paid.` : undefined}><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {workers.map((w) => {
          const p = payslip(w.gross_salary), on = !skip.has(w.id)
          return (
            <li key={w.id} className={cn('px-4 py-3', !on && 'opacity-50')}>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={on} onChange={() => toggle(w.id)} className="h-4 w-4 accent-[#36D6F5]" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{w.full_name}</span><span className="block text-xs text-muted">{METHOD[w.pay_method]}{w.phone ? ` · ${w.phone}` : ''}</span></span>
                <span className="num text-right text-sm font-semibold">{fmt(p.net)}</span>
              </label>
              <p className="num mt-1 pl-7 text-xs text-muted">Gross {fmt(p.gross)} · PAYE {fmt(p.paye)} · NSSF {fmt(p.nssf)} · SHIF {fmt(p.shif)} · Housing {fmt(p.housing_levy)}</p>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-sunken p-4">
        <Stat label="To workers" value={fmt(t.total_net)} />
        <Stat label="Taxes & levies" value={fmt(t.statutory)} note="Remit to KRA by the 9th" />
        <Stat label="Total cost" value={fmt(t.employer_cost)} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={!lines.length || done} onClick={pay}>Pay {lines.length} worker{lines.length === 1 ? '' : 's'} · {fmt(t.total_net)}</Button>
      </div>
    </Modal>
  )
}

const workerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter their name'),
  role: z.string().trim().optional(),
  gross_salary: z.coerce.number().positive('Enter a monthly gross salary'),
  pay_method: z.enum(['mpesa', 'bank', 'cash']),
  phone: z.string().trim().optional(),
  bank_account: z.string().trim().optional(),
  kra_pin: z.string().trim().optional(),
  active: z.boolean(),
}).refine((v) => v.pay_method !== 'mpesa' || /^(\+?254|0)7\d{8}$|^(\+?254|0)1\d{8}$/.test((v.phone ?? '').replace(/\s/g, '')), { message: 'Enter an M-Pesa number like 0712 345 678', path: ['phone'] })

function WorkerForm({ open, worker, onClose }: { open: boolean; worker: Employee | null; onClose(): void }) {
  const { insert, update } = useApp()
  const { fmt } = useMoney()
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof workerSchema>>({ resolver: zodResolver(workerSchema) })
  useEffect(() => {
    if (open) reset(worker ? { ...worker, role: worker.role ?? '', phone: worker.phone ?? '', bank_account: worker.bank_account ?? '', kra_pin: worker.kra_pin ?? '' } : { full_name: '', role: '', gross_salary: undefined as never, pay_method: 'mpesa', phone: '', bank_account: '', kra_pin: '', active: true })
  }, [open, worker, reset])
  const method = watch('pay_method')
  const gross = Number(watch('gross_salary')) || 0
  return (
    <Modal open={open} onClose={onClose} title={worker ? 'Edit worker' : 'Add worker'}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
        const row = { ...v, role: v.role || null, phone: v.phone || null, bank_account: v.bank_account || null, kra_pin: v.kra_pin?.toUpperCase() || null }
        try { if (worker) await update('employees', { id: worker.id }, row); else await insert('employees', [row]); toast.ok(worker ? 'Worker updated' : `${v.full_name} added`); onClose() } catch (e) { toast.error(errMsg(e)) }
      })}>
        <Field label="Full name" error={errors.full_name?.message}><Input autoComplete="off" {...register('full_name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role"><Input placeholder="e.g. Shop attendant" {...register('role')} /></Field>
          <Field label="Gross monthly salary" error={errors.gross_salary?.message}><Input inputMode="decimal" {...register('gross_salary')} /></Field>
        </div>
        {gross > 0 && <p className="num -mt-2 text-xs text-muted">Take-home {fmt(payslip(gross).net)} after PAYE, NSSF, SHIF and housing levy.</p>}
        <Field label="Pay by"><Select {...register('pay_method')}><option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option><option value="cash">Cash</option></Select></Field>
        {method === 'mpesa' && <Field label="M-Pesa number" error={errors.phone?.message}><Input type="tel" inputMode="tel" placeholder="0712 345 678" {...register('phone')} /></Field>}
        {method === 'bank' && <Field label="Bank and account number"><Input placeholder="e.g. Equity 0123456789" {...register('bank_account')} /></Field>}
        <Field label="KRA PIN (optional)"><Input className="uppercase" {...register('kra_pin')} /></Field>
        {worker && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#36D6F5]" {...register('active')} />Currently employed</label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{worker ? 'Save changes' : 'Add worker'}</Button></div>
      </form>
    </Modal>
  )
}
