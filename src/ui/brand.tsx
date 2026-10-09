import { useState } from 'react'
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns'
import { serviceByKey } from '@/domain/catalog'
import type { Occurrence } from '@/domain/finance'
import { cn } from './kit'

export function LogoMark({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <path d="M15 52 A 38 38 0 0 1 32 12" />
        <path d="M32 12 A 38 38 0 0 1 49 52" />
      </g>
      <path d="M19.5 39.5 A 13 4.6 -8 0 0 44.5 36" fill="none" stroke={mono ? 'currentColor' : '#36D6F5'} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="32" cy="37.6" r="3.6" fill={mono ? 'currentColor' : '#36D6F5'} />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="h-7 w-7" />
      <span className="font-display text-[19px] font-semibold tracking-tight">Axial</span>
    </span>
  )
}

/** Official service logo from the Simple Icons CDN; falls back to initials. */
export function ServiceLogo({ serviceKey, name, size = 36 }: { serviceKey: string | null; name: string; size?: number }) {
  const svc = serviceByKey(serviceKey)
  const [broken, setBroken] = useState(false)
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="grid shrink-0 place-items-center rounded-[10px] border border-line bg-white" style={{ width: size, height: size }}>
      {svc?.icon && !broken
        ? <img src={`https://cdn.simpleicons.org/${svc.icon}`} alt={`${name} logo`} width={size * 0.55} height={size * 0.55} loading="lazy" onError={() => setBroken(true)} />
        : <span className="font-display text-[12px] font-semibold text-deep">{initials}</span>}
    </span>
  )
}

/**
 * The billing orbit: the next N days laid around a ring, with each renewal
 * placed at its day. Today sits at the top; the centre shows what's due.
 */
export function OrbitDial({ occurrences, days = 30, today, centerLabel, centerValue, size = 320, onSelect, animate = true }: {
  occurrences: Occurrence[]; days?: number; today: string; centerLabel: string; centerValue: string; size?: number; onSelect?(o: Occurrence): void; animate?: boolean
}) {
  const c = 160, R = 116
  const pos = (d: number, r = R) => { const a = (d / days) * Math.PI * 2 - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)] as const }
  const t0 = parseISO(today)
  const byDay = new Map<number, Occurrence[]>()
  occurrences.forEach((o) => { const d = differenceInCalendarDays(parseISO(o.date), t0); if (d >= 0 && d < days) byDay.set(d, [...(byDay.get(d) ?? []), o]) })
  const len = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 320 320" width="100%" fontFamily="Hanken Grotesk, system-ui, sans-serif" style={{ maxWidth: size }} role="img" aria-label={`${centerLabel}: ${centerValue}. ${occurrences.length} renewals in the next ${days} days.`}>
      <circle cx={c} cy={c} r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="1.5" />
      <circle cx={c} cy={c} r={R} fill="none" stroke="#36D6F5" strokeWidth="1.5" strokeLinecap="round" className={animate ? 'orbit-draw' : ''} style={{ ['--len' as string]: len, opacity: 0.55 }} transform={`rotate(-90 ${c} ${c})`} />
      <circle cx={c} cy={c} r={R - 34} fill="none" stroke="rgb(var(--line))" strokeDasharray="2 5" />
      {Array.from({ length: days }, (_, d) => {
        const [x1, y1] = pos(d, R - 5), [x2, y2] = pos(d, R + 5)
        const week = format(addDays(t0, d), 'EEE') === 'Mon'
        return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--muted))" strokeOpacity={week ? 0.7 : 0.25} strokeWidth={week ? 1.5 : 1} />
      })}
      {[0, 7, 14, 21].map((d) => { const [x, y] = pos(d, R + 22); return <text key={d} x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{d === 0 ? 'Today' : format(addDays(t0, d), 'd MMM')}</text> })}
      {[...byDay.entries()].map(([d, list], i) => {
        const [x, y] = pos(d)
        const amount = list.reduce((a, o) => a + o.sub.amount, 0)
        const r = Math.max(7, Math.min(15, 5 + Math.sqrt(amount) / 6))
        return (
          <g key={d} className={animate ? 'orbit-pop' : ''} style={{ animationDelay: `${0.4 + i * 0.06}s`, cursor: onSelect ? 'pointer' : undefined }} onClick={() => onSelect?.(list[0])}>
            <title>{list.map((o) => `${o.sub.name} — ${o.sub.currency} ${o.sub.amount.toLocaleString()} on ${format(parseISO(o.date), 'd MMM')}`).join('\n')}</title>
            <circle cx={x} cy={y} r={r + 4} fill="rgb(var(--surface))" />
            <circle cx={x} cy={y} r={r} fill={d <= 3 ? '#F3B74F' : '#102746'} className="dark:fill-cyan" />
            {list.length > 1 && <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#F7F9FC">{list.length}</text>}
          </g>
        )
      })}
      <text x={c} y={c - 22} textAnchor="middle" fontSize="11.5" fill="rgb(var(--muted))">{centerLabel}</text>
      <text x={c} y={c + 8} textAnchor="middle" fontSize="24" fontWeight="600" fill="rgb(var(--ink))" style={{ fontFamily: "'Bricolage Grotesque', 'Hanken Grotesk', system-ui, sans-serif", fontVariantNumeric: 'tabular-nums' }}>{centerValue}</text>
      <text x={c} y={c + 28} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">{occurrences.length} renewal{occurrences.length === 1 ? '' : 's'} · {days} days</text>
    </svg>
  )
}
