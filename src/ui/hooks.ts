import { useMemo } from 'react'
import { useApp } from '@/data/AppData'
import { DEFAULT_CATEGORIES, INCOME_CATEGORIES } from '@/domain/types'
import { iso } from '@/domain/finance'
import { money } from './format'

export function useMoney() {
  const { profile } = useApp()
  const currency = profile?.currency ?? 'KES'
  const hide = profile?.hide_amounts ?? false
  return {
    currency,
    fmt: (n: number, c = currency, o?: { compact?: boolean; sign?: boolean }) => (hide ? `${c} ••••` : money(n, c, o)),
  }
}

export function useCategories() {
  const { profile } = useApp()
  return useMemo(() => ({
    expense: [...DEFAULT_CATEGORIES, ...(profile?.custom_categories ?? [])],
    income: [...INCOME_CATEGORIES],
  }), [profile?.custom_categories])
}

export const todayISO = () => iso(new Date())

export function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const CHART = { navy: '#102746', cyan: '#36D6F5', good: '#39C99A', bad: '#F16F78', warn: '#F3B74F', slate: '#8C9AAF' }
export const CAT_COLORS = ['#102746', '#36D6F5', '#39C99A', '#F3B74F', '#8C9AAF', '#5B7FB8', '#F16F78', '#2A9DB5']
