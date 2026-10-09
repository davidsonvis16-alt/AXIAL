// CSV import/export for transactions, with duplicate detection.
import type { Transaction, TxKind } from './types'

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(',')).join('\n')

export function transactionsToCSV(tx: Transaction[]) {
  return toCSV([
    ['date', 'type', 'description', 'category', 'amount', 'currency', 'recurring', 'notes'],
    ...tx.map((t) => [t.occurred_on, t.kind, t.description, t.category, t.amount.toFixed(2), t.currency, t.is_recurring ? 'yes' : 'no', t.notes ?? '']),
  ])
}

export const importHash = (date: string, amount: number, kind: TxKind, desc: string) =>
  `${date}|${kind}|${amount.toFixed(2)}|${desc.trim().toLowerCase().replace(/\s+/g, ' ')}`

export interface ImportRow { occurred_on: string; kind: TxKind; amount: number; description: string; category: string; import_hash: string }
export interface ImportResult { rows: ImportRow[]; duplicates: number; errors: string[] }

function normDate(s: string): string | null {
  const v = s.trim()
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/) // day/month/year (Kenyan statements)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}
const num = (s: string) => {
  const n = Number(String(s ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Accepts headers: date, description/details, amount (signed) OR debit/withdrawn + credit/paid in,
 * optional type and category. Rows already present (same hash) are skipped.
 */
export function importTransactions(text: string, existingHashes: Set<string>): ImportResult {
  const [header, ...body] = parseCSV(text)
  const errors: string[] = []
  if (!header) return { rows: [], duplicates: 0, errors: ['The file is empty.'] }
  const h = header.map((x) => x.trim().toLowerCase())
  const col = (...names: string[]) => h.findIndex((x) => names.some((n) => x.includes(n)))
  const iDate = col('date', 'completion time')
  const iDesc = col('description', 'details', 'narration', 'memo')
  const iAmt = h.findIndex((x) => x === 'amount')
  const iDebit = col('debit', 'withdrawn', 'money out')
  const iCredit = col('credit', 'paid in', 'money in')
  const iType = col('type')
  const iCat = col('category')
  if (iDate < 0 || iDesc < 0 || (iAmt < 0 && iDebit < 0 && iCredit < 0)) {
    return { rows: [], duplicates: 0, errors: ['Could not find date, description and amount columns. Check the first row has headers.'] }
  }
  const rows: ImportRow[] = []
  const seen = new Set(existingHashes)
  let duplicates = 0
  body.forEach((r, idx) => {
    const date = normDate(r[iDate] ?? '')
    const description = (r[iDesc] ?? '').trim().slice(0, 140)
    let kind: TxKind
    let amount: number
    if (iAmt >= 0) {
      const a = num(r[iAmt])
      const t = iType >= 0 ? (r[iType] ?? '').toLowerCase() : ''
      kind = t.startsWith('inc') || t.startsWith('cr') ? 'income' : t.startsWith('exp') || t.startsWith('de') ? 'expense' : a < 0 ? 'expense' : 'income'
      amount = Math.abs(a)
    } else {
      const d = num(r[iDebit] ?? ''), c = num(r[iCredit] ?? '')
      if (Math.abs(d) > 0) { kind = 'expense'; amount = Math.abs(d) } else { kind = 'income'; amount = Math.abs(c) }
    }
    if (!date || !description || !(amount > 0)) { errors.push(`Row ${idx + 2}: missing or invalid date, description or amount.`); return }
    const hash = importHash(date, amount, kind, description)
    if (seen.has(hash)) { duplicates++; return }
    seen.add(hash)
    rows.push({ occurred_on: date, kind, amount, description, category: (iCat >= 0 && r[iCat]?.trim()) || (kind === 'income' ? 'Other income' : 'Other'), import_hash: hash })
  })
  return { rows, duplicates, errors }
}

/** Expenses with the same description repeating at a regular interval (statement-based detection). */
export function findRecurring(tx: Transaction[], knownNames: string[]) {
  const known = knownNames.map((n) => n.toLowerCase())
  const groups = new Map<string, Transaction[]>()
  for (const t of tx.filter((t) => t.kind === 'expense')) {
    const k = t.description.toLowerCase().replace(/[0-9#*]+/g, '').replace(/\s+/g, ' ').trim()
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const out: { description: string; amount: number; frequency: 'weekly' | 'monthly'; last: string; count: number }[] = []
  for (const [k, list] of groups) {
    if (list.length < 2 || known.some((n) => k.includes(n) || n.includes(k))) continue
    const sorted = [...list].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
    const gaps = sorted.slice(1).map((t, i) => (Date.parse(t.occurred_on) - Date.parse(sorted[i].occurred_on)) / 86400000)
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const amounts = sorted.map((t) => t.amount)
    const stable = Math.max(...amounts) <= Math.min(...amounts) * 1.15
    const freq = avg >= 25 && avg <= 35 ? 'monthly' : avg >= 6 && avg <= 8 ? 'weekly' : null
    if (freq && stable) out.push({ description: sorted.at(-1)!.description, amount: sorted.at(-1)!.amount, frequency: freq, last: sorted.at(-1)!.occurred_on, count: list.length })
  }
  return out
}
