import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Lock, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { vaultPlan } from '@/domain/finance'
import type { Vault, VaultEntry } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Select, Toggle, errMsg, toast } from '@/ui/kit'
import { todayISO, useMoney } from '@/ui/hooks'
import { date } from '@/ui/format'

const KINDS = [['emergency', 'Emergency fund'], ['university', 'University fees'], ['laptop', 'Laptop purchase'], ['rent', 'Rent'], ['travel', 'Travel'], ['business', 'Business capital'], ['custom', 'Something else']]

export default function Vaults({ spaceId = null }: { spaceId?: string | null }) {
  const { data, remove } = useApp()
  const { fmt } = useMoney()
  const [editing, setEditing] = useState<Vault | null | undefined>(undefined)
  const [entry, setEntry] = useState<{ vault: Vault; kind: 'deposit' | 'withdrawal' } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const vaults = data.vaults.filter((v) => v.space_id === spaceId && !v.archived)
  const embedded = spaceId !== null

  const body = (
    <>
      <div className="mb-4 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-[13px] text-muted">
        Vaults track money you've set aside. Axial records your deposits and withdrawals — the money itself stays wherever you keep it (bank, SACCO, M-Shwari). A vault is not a locked bank deposit.
      </div>
      {vaults.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {vaults.map((v) => {
            const entries = data.vault_entries.filter((e) => e.vault_id === v.id)
            const p = vaultPlan(v.goal_amount, entries, v.target_date, new Date())
            const open = openId === v.id
            return (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="flex items-center gap-2 font-display text-lg font-semibold">{v.name}{v.protected && <Lock className="h-4 w-4 text-cyan-ink" aria-label="Protected" />}</h3><p className="text-xs text-muted">{v.held_at ? `Held at ${v.held_at}` : 'Location not set'}{v.target_date && ` · Target ${date(v.target_date)}`}</p></div>
                  <div className="flex gap-0.5"><button aria-label="Edit vault" className="rounded p-1.5 text-muted hover:bg-sunken" onClick={() => setEditing(v)}><Pencil className="h-4 w-4" /></button><button aria-label="Delete vault" className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={async () => { if (confirmDelete(v.name)) { try { await remove('vaults', { id: v.id }); toast.ok('Vault deleted') } catch (e) { toast.error(errMsg(e)) } } }}><Trash2 className="h-4 w-4" /></button></div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3"><p className="num font-display text-2xl font-semibold">{fmt(p.balance)}</p><p className="num text-sm text-muted">of {fmt(v.goal_amount)}</p></div>
                <Progress className="mt-2 h-2" value={p.progress} tone={p.progress >= 100 ? 'good' : 'cyan'} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div><p className="text-xs text-muted">Still needed</p><p className="num font-semibold">{fmt(p.remaining)}</p></div>
                  <div><p className="text-xs text-muted">Suggested</p><p className="num font-semibold">{p.remaining === 0 ? 'Goal reached' : p.overdue ? 'Target passed' : p.perMonth ? `${fmt(p.perMonth)}/mo` : 'Set a target date'}</p>{p.perWeek && <p className="num text-xs text-muted">or {fmt(p.perWeek)}/week</p>}</div>
                  <div><p className="text-xs text-muted">At current pace</p><p className="font-semibold">{p.estimate ? date(p.estimate, 'MMM yyyy') : 'No recent deposits'}</p></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" icon={<ArrowDownLeft className="h-4 w-4" />} onClick={() => setEntry({ vault: v, kind: 'deposit' })}>Record deposit</Button>
                  <Button size="sm" variant="secondary" icon={<ArrowUpRight className="h-4 w-4" />} onClick={() => setEntry({ vault: v, kind: 'withdrawal' })} disabled={p.balance <= 0}>Record withdrawal</Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : v.id)}>{open ? 'Hide history' : 'History'}</Button>
                </div>
                {open && <History entries={entries} />}
              </Card>
            )
          })}
        </div>
      ) : <Card><Empty icon={<PiggyBank className="h-5 w-5" />} title="No savings vaults yet" body="Create a vault for an emergency fund, school fees or a laptop, and record contributions as you make them." action={<Button onClick={() => setEditing(null)}>Create a vault</Button>} /></Card>}
      <VaultForm open={editing !== undefined} vault={editing ?? null} spaceId={spaceId} onClose={() => setEditing(undefined)} />
      <EntryForm target={entry} onClose={() => setEntry(null)} />
    </>
  )
  if (embedded) return <><div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New shared goal</Button></div>{body}</>
  return <><PageHeader title="Savings vaults" sub="Named goals with a target, a plan and a record of every contribution." actions={<Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>New vault</Button>} />{body}</>
}

const confirmDelete = (name: string) => window.confirm(`Delete "${name}" and its contribution history? This can't be undone.`)

function History({ entries }: { entries: VaultEntry[] }) {
  const { fmt } = useMoney()
  const series = useMemo(() => {
    let bal = 0
    return [...entries].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on)).map((e) => { bal += e.kind === 'deposit' ? e.amount : -e.amount; return { d: date(e.occurred_on, 'd MMM'), bal } })
  }, [entries])
  return (
    <div className="mt-4 border-t border-line pt-4">
      {series.length > 1 && <div className="h-28"><ResponsiveContainer><AreaChart data={series} margin={{ left: 0, right: 0, top: 4 }}><XAxis dataKey="d" hide /><Tooltip contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [fmt(v), 'Balance']} /><Area type="monotone" dataKey="bal" stroke="#36D6F5" fill="#36D6F5" fillOpacity={0.15} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
      <ul className="mt-2 max-h-48 divide-y divide-line overflow-auto text-sm">
        {[...entries].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)).map((e) => (
          <li key={e.id} className="flex justify-between py-2"><span>{e.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}{e.note && <span className="text-muted"> · {e.note}</span>}<span className="block text-xs text-muted">{date(e.occurred_on)}</span></span><span className={`num font-semibold ${e.kind === 'deposit' ? 'text-[#1d8a66] dark:text-good' : ''}`}>{e.kind === 'deposit' ? '+' : '−'} {fmt(e.amount)}</span></li>
        ))}
        {!entries.length && <li className="py-2 text-muted">No contributions recorded yet.</li>}
      </ul>
    </div>
  )
}

const vSchema = z.object({ name: z.string().trim().min(1, 'Name your goal').max(60), kind: z.string(), goal_amount: z.coerce.number().positive('Enter a goal amount'), target_date: z.string().optional(), held_at: z.string().max(80).optional(), protected: z.boolean() })
function VaultForm({ open, vault, onClose, spaceId }: { open: boolean; vault: Vault | null; onClose(): void; spaceId: string | null }) {
  const { insert, update } = useApp()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<z.infer<typeof vSchema>>({ resolver: zodResolver(vSchema) })
  useEffect(() => { if (open) reset(vault ? { ...vault, target_date: vault.target_date ?? '', held_at: vault.held_at ?? '' } : { name: '', kind: 'emergency', goal_amount: undefined as never, target_date: '', held_at: '', protected: false }) }, [open, vault, reset])
  return (
    <Modal open={open} onClose={onClose} title={vault ? 'Edit vault' : 'New savings vault'}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        const row = { ...v, target_date: v.target_date || null, held_at: v.held_at || null }
        try { if (vault) await update('vaults', { id: vault.id }, row); else await insert('vaults', [{ ...row, space_id: spaceId }]); toast.ok(vault ? 'Vault updated' : 'Vault created'); onClose() } catch (e) { toast.error(errMsg(e)) }
      })}>
        <Field label="Type"><Select {...register('kind')} onChange={(e) => { setValue('kind', e.target.value); if (!watch('name')) setValue('name', KINDS.find((k) => k[0] === e.target.value)?.[1] ?? '') }}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Goal amount" error={errors.goal_amount?.message}><Input inputMode="decimal" {...register('goal_amount')} /></Field><Field label="Target date"><Input type="date" {...register('target_date')} /></Field></div>
        <Field label="Where the money is kept" hint="e.g. Equity savings, M-Shwari, SACCO"><Input {...register('held_at')} /></Field>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-3 py-3"><span className="text-sm"><b className="font-semibold">Protect this vault</b><span className="block text-xs text-muted">Withdrawals need an extra confirmation in Axial and trigger an alert. Your bank isn't affected.</span></span><Toggle checked={watch('protected')} onChange={(c) => setValue('protected', c)} label="Protect this vault" /></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{vault ? 'Save changes' : 'Create vault'}</Button></div>
      </form>
    </Modal>
  )
}

function EntryForm({ target, onClose }: { target: { vault: Vault; kind: 'deposit' | 'withdrawal' } | null; onClose(): void }) {
  const { insert, data } = useApp()
  const { fmt } = useMoney()
  const [amount, setAmount] = useState('')
  const [on, setOn] = useState(todayISO())
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setAmount(''); setNote(''); setConfirm(''); setOn(todayISO()) }, [target])
  if (!target) return null
  const { vault, kind } = target
  const bal = vaultPlan(vault.goal_amount, data.vault_entries.filter((e) => e.vault_id === vault.id), null, new Date()).balance
  const n = Number(amount)
  const needsConfirm = kind === 'withdrawal' && vault.protected
  const invalid = !(n > 0) || (kind === 'withdrawal' && n > bal) || (needsConfirm && confirm.trim().toLowerCase() !== vault.name.toLowerCase())
  return (
    <Modal open onClose={onClose} title={kind === 'deposit' ? `Record deposit to ${vault.name}` : `Record withdrawal from ${vault.name}`}>
      <div className="space-y-4">
        <p className="text-[13px] text-muted">{kind === 'deposit' ? 'Record money you have already moved to where this goal is kept.' : 'Record money you took out. Axial does not move money.'}</p>
        <div className="grid grid-cols-2 gap-3"><Field label="Amount" error={kind === 'withdrawal' && n > bal ? `Vault holds ${fmt(bal)}` : undefined}><Input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Date"><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field></div>
        <Field label="Note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></Field>
        {needsConfirm && <Field label={`This vault is protected. Type "${vault.name}" to confirm.`}><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>}
        {needsConfirm && <Badge tone="warn">An alert will be logged for this withdrawal</Badge>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={invalid} loading={busy} onClick={async () => {
          setBusy(true)
          try { await insert('vault_entries', [{ vault_id: vault.id, kind, amount: n, occurred_on: on, note: note || null }]); toast.ok(kind === 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded'); onClose() } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
        }}>{kind === 'deposit' ? 'Record deposit' : 'Record withdrawal'}</Button></div>
      </div>
    </Modal>
  )
}
