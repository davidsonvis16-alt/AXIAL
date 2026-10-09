import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, Trash2, Workflow } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { RULE_TYPES, describeRule } from '@/domain/rules'
import type { Rule, RuleType } from '@/domain/types'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, Toggle, errMsg, toast } from '@/ui/kit'
import { useCategories, useMoney } from '@/ui/hooks'
import { ago } from '@/ui/format'

const PRESETS: { type: RuleType; name: string; threshold: number | null; category?: string }[] = [
  { type: 'save_percent_of_income', name: 'Pay myself first', threshold: 20 },
  { type: 'category_limit', name: 'Entertainment cap', threshold: 5000, category: 'Entertainment' },
  { type: 'budget_threshold', name: 'Budget early warning', threshold: 80 },
  { type: 'scheduled_saving', name: 'Weekly saving', threshold: 1000 },
  { type: 'subscription_price_increase', name: 'Price watch', threshold: null },
  { type: 'recurring_cap', name: 'Recurring under target', threshold: 20000 },
  { type: 'protect_savings', name: 'Guard my savings', threshold: null },
]

export default function Rules() {
  const { data, update, remove } = useApp()
  const { currency } = useMoney()
  const [editing, setEditing] = useState<Partial<Rule> | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const rules = data.rules.filter((r) => !r.space_id)
  return (
    <>
      <PageHeader title="Financial rules" sub="Rules check your records automatically. They warn you or plan a saving — they never move or block real money." actions={<Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New rule</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[['Warns you', 'warn', 'Tracks a limit and alerts you when you get close or go over.'], ['Records an intended saving', 'cyan', 'Calculates what to set aside. You move the money, then record the deposit.'], ['Moves or blocks money', 'neutral', 'Needs a connected bank or wallet integration. Not available yet.']].map(([t, tone, d]) => (
          <div key={t} className="rounded-xl border border-line bg-surface p-4"><Badge tone={tone as 'warn'}>{t}</Badge><p className="mt-2 text-[13px] text-muted">{d}</p></div>
        ))}
      </div>
      {rules.length ? (
        <div className="space-y-3">
          {rules.map((r) => {
            const events = data.rule_events.filter((e) => e.rule_id === r.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
            const meta = RULE_TYPES[r.type]
            return (
              <Card key={r.id} className={r.active ? '' : 'opacity-70'}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sunken text-cyan-ink"><Workflow className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-display font-semibold">{r.name}</h3><Badge tone={meta.effect === 'Warns you' ? 'warn' : meta.effect === 'Requires approval' ? 'neutral' : 'cyan'}>{meta.effect}</Badge>{!r.active && <Badge>Paused</Badge>}</div>
                    <p className="mt-0.5 text-sm text-muted">{describeRule(r, currency)}{r.vault_id && ` → ${data.vaults.find((v) => v.id === r.vault_id)?.name ?? 'vault'}`}</p>
                    {r.description && <p className="mt-1 text-sm">{r.description}</p>}
                    <p className="mt-2 text-xs text-muted">{events.length ? `Last triggered ${ago(events[0].created_at)} · ${events.length} event${events.length > 1 ? 's' : ''}` : 'Not triggered yet'} · {r.notify_in_app ? 'In-app alerts' : 'No alerts'}{r.notify_email ? ' + email' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Toggle checked={r.active} onChange={async (v) => { try { await update('rules', { id: r.id }, { active: v }); toast.ok(v ? 'Rule resumed' : 'Rule paused') } catch (e) { toast.error(errMsg(e)) } }} label={r.active ? 'Pause rule' : 'Resume rule'} />
                    <button aria-label="Edit rule" className="ml-2 rounded p-1.5 text-muted hover:bg-sunken" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Delete rule" className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={async () => { try { await remove('rules', { id: r.id }); toast.ok('Rule deleted') } catch (e) { toast.error(errMsg(e)) } }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {events.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <button className="text-[13px] font-semibold text-cyan-ink" onClick={() => setHistoryFor(historyFor === r.id ? null : r.id)}>{historyFor === r.id ? 'Hide history' : 'Execution history'}</button>
                    {historyFor === r.id && <ul className="mt-2 max-h-56 space-y-2 overflow-auto text-sm">{events.map((e) => <li key={e.id} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.outcome === 'warning' ? 'bg-warn' : e.outcome === 'allocation' ? 'bg-cyan' : 'bg-slate'}`} /><span className="flex-1">{e.message}</span><span className="shrink-0 text-xs text-muted">{ago(e.created_at)}</span></li>)}</ul>}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      ) : (
        <Card><Empty icon={<Workflow className="h-5 w-5" />} title="No rules yet" body="Start from a common rule and adjust it to fit." /><div className="flex flex-wrap justify-center gap-2 pb-4">{PRESETS.map((p) => <Button key={p.type} size="sm" variant="secondary" onClick={() => setEditing({ ...p, frequency: p.type === 'scheduled_saving' ? 'weekly' : 'monthly' })}>{RULE_TYPES[p.type].label}</Button>)}</div></Card>
      )}
      <RuleForm initial={editing} onClose={() => setEditing(null)} />
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name this rule').max(80),
  description: z.string().max(240).optional(),
  type: z.enum(Object.keys(RULE_TYPES) as [RuleType, ...RuleType[]]),
  threshold: z.coerce.number().positive('Enter a value above zero').optional().or(z.literal('').transform(() => undefined)),
  category: z.string().optional(),
  vault_id: z.string().optional(),
  notify_in_app: z.boolean(),
  notify_email: z.boolean(),
}).superRefine((v, ctx) => {
  const needs = RULE_TYPES[v.type].needs
  if (needs.includes('threshold') && !v.threshold) ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'This rule needs a value' })
  if (needs.includes('threshold') && RULE_TYPES[v.type].unit === '%' && (v.threshold ?? 0) > 100) ctx.addIssue({ code: 'custom', path: ['threshold'], message: 'Use a percentage up to 100' })
  if (needs.includes('category') && !v.category) ctx.addIssue({ code: 'custom', path: ['category'], message: 'Pick a category' })
})
type V = z.infer<typeof schema>

function RuleForm({ initial, onClose }: { initial: Partial<Rule> | null; onClose(): void }) {
  const { insert, update, data } = useApp()
  const cats = useCategories()
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) })
  useEffect(() => { if (initial) reset({ name: initial.name ?? '', description: initial.description ?? '', type: initial.type ?? 'category_limit', threshold: initial.threshold ?? undefined, category: initial.category ?? 'Food', vault_id: initial.vault_id ?? '', notify_in_app: initial.notify_in_app ?? true, notify_email: initial.notify_email ?? false }) }, [initial, reset])
  if (!initial) return null
  const type = watch('type') ?? 'category_limit'
  const meta = RULE_TYPES[type]
  const vaults = data.vaults.filter((v) => !v.space_id)
  return (
    <Modal open onClose={onClose} title={initial.id ? 'Edit rule' : 'New rule'}>
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        const row = { ...v, threshold: v.threshold ?? null, category: meta.needs.includes('category') ? v.category ?? null : null, vault_id: meta.needs.includes('vault') && v.vault_id ? v.vault_id : null, description: v.description ?? '', frequency: (type === 'scheduled_saving' ? 'weekly' : type === 'save_percent_of_income' || type === 'subscription_price_increase' ? 'per_event' : 'monthly') as Rule['frequency'] }
        try { if (initial.id) await update('rules', { id: initial.id }, row); else await insert('rules', [{ ...row, space_id: null, active: true }]); toast.ok(initial.id ? 'Rule updated' : 'Rule created'); onClose() } catch (e) { toast.error(errMsg(e)) }
      })}>
        <Field label="What should this rule do?"><Select {...register('type')} onChange={(e) => { setValue('type', e.target.value as RuleType); if (!watch('name')) setValue('name', PRESETS.find((p) => p.type === e.target.value)?.name ?? '') }}>{Object.entries(RULE_TYPES).filter(([k]) => k !== 'shared_approval').map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}</Select></Field>
        <Badge tone={meta.effect === 'Warns you' ? 'warn' : 'cyan'}>{meta.effect}</Badge>
        <Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
        {meta.needs.includes('threshold') && <Field label={meta.unit === '%' ? 'Percentage' : 'Amount'} error={errors.threshold?.message}><Input inputMode="decimal" {...register('threshold')} /></Field>}
        {meta.needs.includes('category') && <Field label="Category" error={errors.category?.message}><Select {...register('category')}>{cats.expense.map((c) => <option key={c}>{c}</option>)}</Select></Field>}
        {meta.needs.includes('vault') && <Field label="Towards vault (optional)"><Select {...register('vault_id')}><option value="">No specific vault</option>{vaults.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>}
        <Field label="Description (optional)"><Textarea {...register('description')} /></Field>
        <div className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between text-sm"><span>In-app alerts</span><Toggle checked={watch('notify_in_app')} onChange={(c) => setValue('notify_in_app', c)} label="In-app alerts" /></div>
          <div className="flex items-center justify-between text-sm"><span>Email alerts <span className="text-xs text-muted">(needs email delivery set up)</span></span><Toggle checked={watch('notify_email')} onChange={(c) => setValue('notify_email', c)} label="Email alerts" /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{initial.id ? 'Save changes' : 'Create rule'}</Button></div>
      </form>
    </Modal>
  )
}
