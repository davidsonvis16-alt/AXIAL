import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Pencil, Plus, Repeat, Trash2, Upload, Search } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { importTransactions, transactionsToCSV } from '@/domain/csv'
import type { Transaction } from '@/domain/types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, errMsg, toast } from '@/ui/kit'
import { download, useMoney } from '@/ui/hooks'
import { date } from '@/ui/format'
import TxForm from '@/ui/TxForm'

const PAGE = 25

export default function Transactions() {
  const { data, remove, insert } = useApp()
  const { fmt, currency } = useMoney()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [kind, setKind] = useState('all')
  const [cat, setCat] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Transaction | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const rows = useMemo(() => data.transactions
    .filter((t) => (kind === 'all' || t.kind === kind) && (cat === 'all' || t.category === cat) && (!from || t.occurred_on >= from) && (!to || t.occurred_on <= to)
      && (!q || `${t.description} ${t.notes ?? ''} ${t.category}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)), [data.transactions, q, kind, cat, from, to])
  const sum = rows.filter((r) => r.currency === currency).reduce((a, r) => a + (r.kind === 'income' ? r.amount : -r.amount), 0)
  const cats = [...new Set(data.transactions.map((t) => t.category))].sort()

  return (
    <>
      <PageHeader title="Transactions" sub="Everything you've recorded. Add entries by hand or import a CSV statement."
        actions={<>
          <Button variant="secondary" size="sm" className="h-9" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button variant="secondary" size="sm" className="h-9" icon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => download(`axial-transactions-${new Date().toISOString().slice(0, 10)}.csv`, transactionsToCSV(rows))}>Export</Button>
          <Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Add transaction</Button>
        </>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><Input aria-label="Search transactions" placeholder="Search" className="h-9 pl-9" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} /></div>
          <Select aria-label="Type" className="h-9 w-auto" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1) }}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></Select>
          <Select aria-label="Category" className="h-9 w-auto" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1) }}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
          <Input aria-label="From date" type="date" className="h-9 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="To date" type="date" className="h-9 w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex justify-between px-4 py-2.5 text-[13px] text-muted"><span>{rows.length} transaction{rows.length === 1 ? '' : 's'}</span><span className="num">Net {fmt(sum, currency, { sign: true })}</span></div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-line bg-sunken/60 text-left text-[12px] text-muted"><tr><th className="px-4 py-2 font-semibold">Date</th><th className="px-4 py-2 font-semibold">Description</th><th className="hidden px-4 py-2 font-semibold sm:table-cell">Category</th><th className="px-4 py-2 text-right font-semibold">Amount</th><th className="w-20" /></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, page * PAGE).map((t) => (
                  <tr key={t.id} className="group hover:bg-sunken/40">
                    <td className="num whitespace-nowrap px-4 py-3 text-muted">{date(t.occurred_on, 'd MMM yy')}</td>
                    <td className="px-4 py-3"><span className="font-medium">{t.description}</span>
                      <span className="ml-2 inline-flex gap-1 align-middle">{t.is_recurring && <Badge><Repeat className="h-3 w-3" />Recurring</Badge>}{t.source === 'csv' && <Badge>Imported</Badge>}{t.source === 'demo' && <Badge tone="warn">Sample</Badge>}</span>
                      {t.notes && <span className="block text-xs text-muted">{t.notes}</span>}<span className="block text-xs text-muted sm:hidden">{t.category}</span></td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{t.category}</td>
                    <td className={`num whitespace-nowrap px-4 py-3 text-right font-semibold ${t.kind === 'income' ? 'text-[#1d8a66] dark:text-good' : ''}`}>{fmt(t.kind === 'income' ? t.amount : -t.amount, t.currency, { sign: true })}</td>
                    <td className="px-2 py-3"><div className="flex justify-end gap-0.5"><button className="rounded p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label={`Edit ${t.description}`} onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" aria-label={`Delete ${t.description}`} onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > page * PAGE && <div className="p-4 text-center"><Button variant="secondary" size="sm" onClick={() => setPage(page + 1)}>Show more</Button></div>}
          </div>
        ) : <Empty title={data.transactions.length ? 'No transactions match these filters' : 'No transactions yet'} body={data.transactions.length ? 'Try clearing the search or date range.' : 'Record income and expenses, or import a CSV statement from your bank or M-Pesa.'} action={!data.transactions.length && <Button onClick={() => setEditing(null)}>Add transaction</Button>} />}
      </Card>
      <TxForm open={editing !== undefined} tx={editing} onClose={() => setEditing(undefined)} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete transaction?">
        <p className="text-sm text-muted">"{deleting?.description}" will be removed from your records and totals. This can't be undone.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={async () => { try { await remove('transactions', { id: deleting!.id }); toast.ok('Transaction deleted') } catch (e) { toast.error(errMsg(e)) } setDeleting(null) }}>Delete</Button></div>
      </Modal>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={async (r) => { await insert('transactions', r.map((x) => ({ ...x, currency, source: 'csv' as const, is_recurring: false, notes: null })), 'user_id,import_hash') }} existing={new Set(data.transactions.map((t) => t.import_hash).filter(Boolean) as string[])} />
    </>
  )
}

function ImportModal({ open, onClose, onImport, existing }: { open: boolean; onClose(): void; onImport(rows: ReturnType<typeof importTransactions>['rows']): Promise<void>; existing: Set<string> }) {
  const [result, setResult] = useState<ReturnType<typeof importTransactions> | null>(null)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const close = () => { setResult(null); onClose() }
  return (
    <Modal open={open} onClose={close} title="Import transactions from CSV" wide>
      <p className="text-sm text-muted">Use a file with a header row containing <b>date</b>, <b>description</b> and either <b>amount</b> (negative for spending) or <b>debit</b>/<b>credit</b> columns. Optional: <b>category</b>, <b>type</b>. Dates can be YYYY-MM-DD or DD/MM/YYYY. Rows you've already imported are skipped.</p>
      <input ref={ref} type="file" accept=".csv,text/csv" className="mt-4 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sunken file:px-3 file:py-2 file:text-sm file:font-semibold"
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) setResult(importTransactions(await f.text(), existing)) }} />
      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 text-sm"><Badge tone="good">{result.rows.length} ready</Badge><Badge>{result.duplicates} duplicates skipped</Badge>{result.errors.length > 0 && <Badge tone="bad">{result.errors.length} problems</Badge>}</div>
          {result.errors.length > 0 && <ul className="max-h-24 overflow-auto text-xs text-bad">{result.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>}
          {result.rows.length > 0 && <div className="max-h-56 overflow-auto rounded-lg border border-line text-xs"><table className="w-full"><tbody className="divide-y divide-line">{result.rows.slice(0, 50).map((r) => <tr key={r.import_hash}><td className="px-3 py-1.5">{r.occurred_on}</td><td className="px-3 py-1.5">{r.description}</td><td className="px-3 py-1.5">{r.category}</td><td className="num px-3 py-1.5 text-right">{r.kind === 'expense' ? '−' : '+'}{r.amount.toFixed(2)}</td></tr>)}</tbody></table></div>}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={close}>Cancel</Button><Button disabled={!result?.rows.length} loading={busy} onClick={async () => { setBusy(true); try { await onImport(result!.rows); toast.ok(`Imported ${result!.rows.length} transactions`); close() } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) } }}>Import {result?.rows.length || ''} transactions</Button></div>
    </Modal>
  )
}
