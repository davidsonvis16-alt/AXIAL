import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useApp } from '@/data/AppData'
import type { Transaction } from '@/domain/types'
import { Button, Field, Input, Modal, Segmented, Select, Textarea, Toggle, errMsg, toast } from './kit'
import { todayISO, useCategories, useMoney } from './hooks'

const schema = z.object({
  kind: z.enum(['income', 'expense']),
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be more than zero').max(1e11),
  description: z.string().trim().min(1, 'Add a short description').max(140),
  category: z.string().min(1),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  currency: z.string().length(3),
  is_recurring: z.boolean(),
  notes: z.string().max(500).optional(),
})
type V = z.infer<typeof schema>

export default function TxForm({ open, onClose, tx }: { open: boolean; onClose(): void; tx?: Transaction | null }) {
  const { insert, update } = useApp()
  const cats = useCategories()
  const { currency } = useMoney()
  const { register, handleSubmit, watch, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (open) reset(tx ? { ...tx, notes: tx.notes ?? '' } : { kind: 'expense', amount: undefined as never, description: '', category: 'Food', occurred_on: todayISO(), currency, is_recurring: false, notes: '' })
  }, [open, tx, reset, currency])
  const kind = watch('kind')
  const onSubmit = handleSubmit(async (v) => {
    try {
      const row = { ...v, notes: v.notes || null, currency: v.currency.toUpperCase() }
      if (tx) await update('transactions', { id: tx.id }, row)
      else await insert('transactions', [{ ...row, source: 'manual' }])
      toast.ok(tx ? 'Transaction updated' : 'Transaction added')
      onClose()
    } catch (e) { toast.error(errMsg(e)) }
  })
  return (
    <Modal open={open} onClose={onClose} title={tx ? 'Edit transaction' : 'Add transaction'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Controller control={control} name="kind" render={({ field }) => (
          <Segmented value={field.value} onChange={(v) => { field.onChange(v); setValue('category', v === 'income' ? cats.income[0] : 'Food') }} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        )} />
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="Amount" error={errors.amount?.message}><Input inputMode="decimal" autoFocus placeholder="0.00" {...register('amount')} /></Field>
          <Field label="Currency" error={errors.currency?.message}><Input maxLength={3} className="uppercase" {...register('currency')} /></Field>
        </div>
        <Field label="Description" error={errors.description?.message}><Input placeholder={kind === 'income' ? 'e.g. Client payment' : 'e.g. Groceries'} {...register('description')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select {...register('category')}>{(kind === 'income' ? cats.income : cats.expense).map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Date" error={errors.occurred_on?.message}><Input type="date" {...register('occurred_on')} /></Field>
        </div>
        <Controller control={control} name="is_recurring" render={({ field }) => (
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="text-sm">Recurring payment</span><Toggle checked={!!field.value} onChange={field.onChange} label="Recurring payment" /></div>
        )} />
        <Field label="Notes (optional)"><Textarea {...register('notes')} /></Field>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={isSubmitting}>{tx ? 'Save changes' : 'Add transaction'}</Button></div>
      </form>
    </Modal>
  )
}
