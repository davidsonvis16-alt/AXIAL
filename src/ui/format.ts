import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'

export function money(n: number, currency = 'KES', opts: { compact?: boolean; sign?: boolean } = {}) {
  const f = new Intl.NumberFormat('en-KE', {
    style: 'currency', currency, currencyDisplay: 'code',
    maximumFractionDigits: opts.compact ? 1 : Number.isInteger(n) ? 0 : 2,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(Math.abs(n)).replace(/ /g, ' ')
  if (opts.sign) return (n < 0 ? '− ' : '+ ') + f
  return n < 0 ? `− ${f}` : f
}
export const date = (s: string, f = 'd MMM yyyy') => format(parseISO(s), f)
export const ago = (s: string) => formatDistanceToNowStrict(parseISO(s), { addSuffix: true })
export const pct = (n: number) => `${Math.round(n)}%`
