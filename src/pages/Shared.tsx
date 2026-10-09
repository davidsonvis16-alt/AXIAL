import { useMemo, useState } from 'react'
import { Check, Copy, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { budgetMonth, inRange, round2 } from '@/domain/finance'
import type { Space, SpaceRole } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Segmented, Select, errMsg, toast } from '@/ui/kit'
import { todayISO, useCategories, useMoney } from '@/ui/hooks'
import { ago, date } from '@/ui/format'
import Vaults from './Vaults'
import { BudgetForm } from './Budgets'

type Tab = 'expenses' | 'balances' | 'budgets' | 'goals' | 'members' | 'activity'

export default function Shared() {
  const { data, userId } = useApp()
  const [sel, setSel] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const spaces = data.spaces
  const space = spaces.find((s) => s.id === sel) ?? spaces[0]
  return (
    <>
      <PageHeader title="Shared finances" sub="Spaces for couples, families, roommates and small teams. Members only see what's shared in the space — never each other's personal records."
        actions={<Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New space</Button>} />
      {spaces.length ? (
        <>
          {spaces.length > 1 && <div className="mb-4 flex flex-wrap gap-2">{spaces.map((s) => <button key={s.id} onClick={() => setSel(s.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${s.id === space?.id ? 'border-navy bg-navy text-snow dark:border-cyan dark:bg-cyan dark:text-navy' : 'border-line hover:bg-sunken'}`}>{s.name}</button>)}</div>}
          {space && <SpaceView key={space.id} space={space} me={userId!} />}
        </>
      ) : <Card><Empty icon={<Users className="h-5 w-5" />} title="No shared spaces yet" body="Create a space, invite the people you share costs with, and split expenses fairly." action={<Button onClick={() => setCreating(true)}>Create a space</Button>} /></Card>}
      <CreateSpace open={creating} onClose={() => setCreating(false)} onCreated={setSel} />
    </>
  )
}

function SpaceView({ space, me }: { space: Space; me: string }) {
  const { data, rpc, remove, update, insert, mode } = useApp()
  const { fmt } = useMoney()
  const [tab, setTab] = useState<Tab>('expenses')
  const [adding, setAdding] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const members = data.space_members.filter((m) => m.space_id === space.id)
  const myRole = members.find((m) => m.user_id === me)?.role ?? 'viewer'
  const canWrite = myRole !== 'viewer'
  const canManage = myRole === 'owner' || myRole === 'admin'
  const name = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? 'Former member'
  const expenses = data.space_expenses.filter((e) => e.space_id === space.id).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
  const pending = expenses.filter((e) => e.status === 'pending')
  const approved = expenses.filter((e) => e.status === 'approved')
  const balances = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of approved) {
      if (e.paid_by) m.set(e.paid_by, (m.get(e.paid_by) ?? 0) + e.amount)
      for (const s of e.split) m.set(s.user_id, (m.get(s.user_id) ?? 0) - s.share)
    }
    return members.map((mb) => ({ mb, net: round2(m.get(mb.user_id) ?? 0) }))
  }, [approved, members])
  const month = budgetMonth(new Date())
  const budgets = data.budgets.filter((b) => b.space_id === space.id)
  const activity = data.space_activity.filter((a) => a.space_id === space.id)

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-display text-xl font-semibold">{space.name}</h2><p className="text-sm text-muted">{members.length} member{members.length === 1 ? '' : 's'} · You're {myRole === 'owner' ? 'the owner' : `a${myRole === 'admin' ? 'n' : ''} ${myRole}`}{space.approval_threshold != null && ` · Expenses from ${fmt(space.approval_threshold)} need approval`}</p></div>
          <div className="flex -space-x-2">{members.slice(0, 6).map((m) => <span key={m.user_id} title={m.display_name} className="grid h-9 w-9 place-items-center rounded-full border-2 border-surface bg-deep font-display text-sm font-semibold text-snow">{m.display_name.slice(0, 1)}</span>)}</div>
        </div>
        {pending.length > 0 && <p className="mt-3 rounded-lg bg-warn/15 px-3 py-2 text-sm"><b>{pending.length}</b> expense{pending.length > 1 ? 's' : ''} waiting for approval.</p>}
      </Card>
      <div className="scrollbar-none mb-4 overflow-x-auto"><Segmented value={tab} onChange={setTab} options={(['expenses', 'balances', 'budgets', 'goals', 'members', 'activity'] as Tab[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></div>

      {tab === 'expenses' && (
        <Card title="Shared expenses" action={canWrite && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add expense</Button>}>
          {expenses.length ? (
            <ul className="-mx-2 divide-y divide-line">{expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-2 py-3">
                <div className="min-w-0 flex-1"><p className="font-medium">{e.description}</p><p className="text-xs text-muted">{name(e.paid_by)} paid · {date(e.occurred_on, 'd MMM')} · split {e.split.length} ways · {e.category}</p></div>
                <span className="num font-semibold">{fmt(e.amount)}</span>
                {e.status === 'pending' ? (
                  canWrite && e.created_by !== me ? (
                    <span className="flex gap-1.5">
                      <Button size="sm" icon={<Check className="h-4 w-4" />} onClick={async () => { try { await rpc('decide_space_expense', { p_expense: e.id, p_approve: true }); toast.ok('Expense approved') } catch (x) { toast.error(errMsg(x)) } }}>Approve</Button>
                      <Button size="sm" variant="secondary" icon={<X className="h-4 w-4" />} onClick={async () => { try { await rpc('decide_space_expense', { p_expense: e.id, p_approve: false }); toast.ok('Expense declined') } catch (x) { toast.error(errMsg(x)) } }}>Decline</Button>
                    </span>
                  ) : <Badge tone="warn">Waiting for approval</Badge>
                ) : <Badge tone={e.status === 'approved' ? 'good' : 'bad'}>{e.status === 'approved' ? 'Approved' : 'Declined'}</Badge>}
                {((e.created_by === me && e.status === 'pending') || canManage) && <button aria-label="Delete expense" className="rounded p-1.5 text-muted hover:text-bad" onClick={async () => { try { await remove('space_expenses', { id: e.id }); toast.ok('Expense removed') } catch (x) { toast.error(errMsg(x)) } }}><Trash2 className="h-4 w-4" /></button>}
              </li>
            ))}</ul>
          ) : <Empty title="No shared expenses yet" body="Add rent, utilities or shopping and Axial splits it between members." />}
        </Card>
      )}

      {tab === 'balances' && (
        <Card title="Who owes whom" >
          <p className="-mt-2 mb-4 text-[13px] text-muted">From approved expenses: what each member paid minus their share.</p>
          <ul className="space-y-3">{balances.map(({ mb, net }) => (
            <li key={mb.user_id} className="flex items-center justify-between gap-3"><span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-sunken font-semibold">{mb.display_name.slice(0, 1)}</span>{mb.display_name}{mb.user_id === me && ' (you)'}</span>
              <span className={`num font-semibold ${net > 0 ? 'text-[#1d8a66] dark:text-good' : net < 0 ? 'text-[#c23d48] dark:text-bad' : 'text-muted'}`}>{net > 0 ? `is owed ${fmt(net)}` : net < 0 ? `owes ${fmt(-net)}` : 'settled'}</span></li>
          ))}</ul>
        </Card>
      )}

      {tab === 'budgets' && (
        <Card title="Shared budgets" action={canWrite && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setBudgetOpen(true)}>Add budget</Button>}>
          {budgets.length ? <ul className="space-y-4">{budgets.map((b) => {
            const spent = approved.filter((e) => e.category === b.category && inRange(e.occurred_on, month)).reduce((a, e) => a + e.amount, 0)
            const pct = (spent / b.amount) * 100
            return <li key={b.id}><div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{b.category}</span><span className="num">{fmt(spent)} / {fmt(b.amount)}</span></div><Progress value={pct} tone={pct > 100 ? 'bad' : pct >= b.warn_at_pct ? 'warn' : 'cyan'} /></li>
          })}</ul> : <Empty title="No shared budgets" body="Set a monthly limit for shared categories like Utilities or Food." />}
        </Card>
      )}

      {tab === 'goals' && <Vaults spaceId={space.id} />}

      {tab === 'members' && (
        <Card title="Members and roles" action={canManage && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setInviting(true)}>Invite</Button>}>
          <ul className="-mx-2 divide-y divide-line">{members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-2 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-deep font-semibold text-snow">{m.display_name.slice(0, 1)}</span>
              <span className="flex-1"><span className="font-medium">{m.display_name}{m.user_id === me && ' (you)'}</span><span className="block text-xs text-muted">Joined {ago(m.joined_at)}</span></span>
              {canManage && m.role !== 'owner' && m.user_id !== me ? (
                <>
                  <Select aria-label="Role" className="h-8 w-auto text-[13px]" value={m.role} onChange={async (e) => { try { await update('space_members', { space_id: space.id, user_id: m.user_id }, { role: e.target.value as SpaceRole }); toast.ok('Role updated') } catch (x) { toast.error(errMsg(x)) } }}><option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option></Select>
                  <button aria-label="Remove member" className="rounded p-1.5 text-muted hover:text-bad" onClick={async () => { try { await remove('space_members', { space_id: space.id, user_id: m.user_id }); toast.ok('Member removed') } catch (x) { toast.error(errMsg(x)) } }}><Trash2 className="h-4 w-4" /></button>
                </>
              ) : <Badge tone={m.role === 'owner' ? 'cyan' : 'neutral'}>{m.role}</Badge>}
            </li>
          ))}</ul>
          <div className="mt-4 flex gap-2 rounded-lg bg-sunken px-3 py-2.5 text-[13px] text-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-cyan-ink" />Owners and admins manage members. Members add expenses and approve others' requests. Viewers can only look. Permissions are enforced by the database.</div>
          {canManage && data.space_invites.filter((i) => i.space_id === space.id && i.status === 'pending').length > 0 && (
            <div className="mt-4"><h3 className="mb-2 text-sm font-semibold">Pending invitations</h3><ul className="space-y-2 text-sm">{data.space_invites.filter((i) => i.space_id === space.id && i.status === 'pending').map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2"><span>{i.email} <span className="text-xs text-muted">· {i.role}</span></span><span className="flex gap-1"><Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard.writeText(`${location.origin}/invite/${i.token}`); toast.ok('Invite link copied') }}>Copy link</Button><Button size="sm" variant="ghost" onClick={async () => { try { await update('space_invites', { id: i.id }, { status: 'revoked' }); toast.ok('Invitation revoked') } catch (x) { toast.error(errMsg(x)) } }}>Revoke</Button></span></li>
            ))}</ul></div>
          )}
        </Card>
      )}

      {tab === 'activity' && (
        <Card title="Activity">
          {activity.length ? <ul className="space-y-3">{activity.map((a) => <li key={a.id} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan" /><span className="flex-1"><b className="font-medium">{name(a.actor_id)}</b> {a.action} <span className="text-muted">{a.detail}</span></span><span className="shrink-0 text-xs text-muted">{ago(a.created_at)}</span></li>)}</ul> : <p className="text-sm text-muted">No activity yet.</p>}
        </Card>
      )}

      <AddExpense open={adding} onClose={() => setAdding(false)} space={space} members={members.map((m) => ({ id: m.user_id, name: m.display_name }))} me={me} onSave={async (row) => { await insert('space_expenses', [row]) }} />
      <BudgetForm open={budgetOpen} budget={null} spaceId={space.id} onClose={() => setBudgetOpen(false)} />
      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite someone">
        {mode === 'demo' ? <p className="text-sm text-muted">Invitations need a real account. Connect Supabase and sign in to invite people to a space.</p> : <InviteForm spaceId={space.id} me={me} onDone={() => setInviting(false)} />}
      </Modal>
    </>
  )
}

function InviteForm({ spaceId, me, onDone }: { spaceId: string; me: string; onDone(): void }) {
  const { insert } = useApp()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin' | 'viewer'>('member')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (link) return (
    <div className="space-y-3 text-sm"><p>Send this link to <b>{email}</b>. They'll need to sign in with that email to join. It expires in 14 days.</p><div className="flex gap-2"><Input readOnly value={link} onFocus={(e) => e.target.select()} /><Button onClick={() => { navigator.clipboard.writeText(link); toast.ok('Link copied') }} icon={<Copy className="h-4 w-4" />}>Copy</Button></div><div className="flex justify-end"><Button variant="secondary" onClick={onDone}>Done</Button></div></div>
  )
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Enter a valid email')
      setBusy(true)
      try { const [inv] = await insert('space_invites', [{ space_id: spaceId, email: email.trim().toLowerCase(), role, invited_by: me }]); setLink(`${location.origin}/invite/${inv.token}`) } catch (x) { toast.error(errMsg(x)) } finally { setBusy(false) }
    }}>
      <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Role"><Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="member">Member — adds and approves expenses</option><option value="admin">Admin — also manages members</option><option value="viewer">Viewer — read only</option></Select></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" loading={busy}>Create invite link</Button></div>
    </form>
  )
}

function AddExpense({ open, onClose, space, members, me, onSave }: { open: boolean; onClose(): void; space: Space; members: { id: string; name: string }[]; me: string; onSave(row: object): Promise<void> }) {
  const cats = useCategories()
  const { fmt } = useMoney()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState('Utilities')
  const [on, setOn] = useState(todayISO())
  const [paidBy, setPaidBy] = useState(me)
  const [who, setWho] = useState<string[]>(members.map((m) => m.id))
  const [busy, setBusy] = useState(false)
  const n = Number(amount)
  const share = who.length ? round2(n / who.length) : 0
  const needsApproval = space.approval_threshold != null && n >= space.approval_threshold
  return (
    <Modal open={open} onClose={onClose} title="Add shared expense">
      <div className="space-y-4">
        <Field label="Description"><Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={140} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field><Field label="Date"><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Category"><Select value={cat} onChange={(e) => setCat(e.target.value)}>{cats.expense.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Paid by"><Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field></div>
        <fieldset><legend className="mb-2 text-[13px] font-semibold">Split equally between</legend><div className="flex flex-wrap gap-2">{members.map((m) => { const on = who.includes(m.id); return <button type="button" key={m.id} aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== m.id) : [...who, m.id])} className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${on ? 'border-cyan bg-cyan/15' : 'border-line text-muted'}`}>{m.name}</button> })}</div>
          {n > 0 && who.length > 0 && <p className="num mt-2 text-xs text-muted">{fmt(share)} each</p>}</fieldset>
        {needsApproval && <p className="rounded-lg bg-warn/15 px-3 py-2 text-[13px]">This is at or above the space's approval limit, so another member needs to approve it.</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!desc.trim() || !(n > 0) || !who.length} onClick={async () => {
          setBusy(true)
          try { await onSave({ space_id: space.id, created_by: me, description: desc.trim(), amount: n, category: cat, occurred_on: on, paid_by: paidBy, split: who.map((u) => ({ user_id: u, share })) }); toast.ok(needsApproval ? 'Sent for approval' : 'Expense added'); setDesc(''); setAmount(''); onClose() } catch (x) { toast.error(errMsg(x)) } finally { setBusy(false) }
        }}>{needsApproval ? 'Request approval' : 'Add expense'}</Button></div>
      </div>
    </Modal>
  )
}

function CreateSpace({ open, onClose, onCreated }: { open: boolean; onClose(): void; onCreated(id: string): void }) {
  const { rpc, profile } = useApp()
  const [name, setName] = useState('')
  const [kind, setKind] = useState('roommates')
  const [threshold, setThreshold] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="New shared space">
      <div className="space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kilimani apartment" maxLength={80} /></Field>
        <Field label="Who is it for?"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="couple">Couple</option><option value="family">Family</option><option value="roommates">Roommates</option><option value="team">Small team</option></Select></Field>
        <Field label="Approval needed from (optional)" hint="Expenses at or above this amount need another member's approval."><Input inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!name.trim()} onClick={async () => {
          setBusy(true)
          try { const id = await rpc<string>('create_space', { p_name: name.trim(), p_kind: kind, p_display_name: profile?.full_name || 'You', p_threshold: threshold ? Number(threshold) : null }); onCreated(id); toast.ok('Space created'); setName(''); onClose() } catch (x) { toast.error(errMsg(x)) } finally { setBusy(false) }
        }}>Create space</Button></div>
      </div>
    </Modal>
  )
}
