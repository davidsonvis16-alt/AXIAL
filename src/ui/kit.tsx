import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import clsx from 'clsx'

export const cn = clsx

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...p }, ref) => (
    <button ref={ref} disabled={disabled || loading} className={cn(
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
      size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
      variant === 'primary' && 'bg-navy text-snow hover:bg-deep dark:bg-cyan dark:text-navy dark:hover:bg-cyan/90',
      variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-sunken',
      variant === 'ghost' && 'text-muted hover:text-ink hover:bg-sunken',
      variant === 'danger' && 'bg-bad/10 text-bad hover:bg-bad/20',
      className)} {...p}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}
    </button>
  ),
)

const field = 'rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/25 disabled:opacity-60'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(field, 'h-10', !/(^|\s)w-/.test(className ?? '') && 'w-full', className)} {...p} />)
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(field, 'h-10 pr-8', !/(^|\s)w-/.test(className ?? '') && 'w-full', className)} {...p} />)
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, 'w-full py-2 min-h-[72px]', className)} {...p} />)

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {error ? <span role="alert" className="block text-xs text-bad">{error}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  )
}

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cn('rounded-2xl border border-line', !/(^|\s)!?bg-/.test(className ?? '') && 'bg-surface', pad && 'p-5', className)}>
      {(title || action) && (
        <header className={cn('mb-4 flex items-center justify-between gap-3', !pad && 'px-5 pt-5')}>
          {title && <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'cyan'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
      tone === 'neutral' && 'bg-sunken text-muted', tone === 'good' && 'bg-good/15 text-[#1d8a66] dark:text-good',
      tone === 'warn' && 'bg-warn/20 text-[#94640e] dark:text-warn', tone === 'bad' && 'bg-bad/15 text-[#c23d48] dark:text-bad', tone === 'cyan' && 'bg-cyan/15 text-cyan-ink')}>{children}</span>
  )
}

export function Progress({ value, tone = 'cyan', className }: { value: number; tone?: 'cyan' | 'good' | 'warn' | 'bad'; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-sunken', className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'cyan' && 'bg-cyan', tone === 'good' && 'bg-good', tone === 'warn' && 'bg-warn', tone === 'bad' && 'bg-bad')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-sunken text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange(v: NoInfer<T>): void; options: { value: NoInfer<T>; label: string }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-sunken p-0.5', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn('rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors', value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-cyan' : 'bg-line')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={cn('num mt-1 truncate font-display text-xl font-semibold tracking-tight sm:text-[22px]', tone === 'good' && 'text-[#1d8a66] dark:text-good', tone === 'bad' && 'text-[#c23d48] dark:text-bad')}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  )
}

// Toasts
type ToastT = { id: number; text: string; tone: 'good' | 'bad' }
let push: ((t: Omit<ToastT, 'id'>) => void) | null = null
export const toast = { ok: (text: string) => push?.({ text, tone: 'good' }), error: (text: string) => push?.({ text, tone: 'bad' }) }
export function Toaster() {
  const [list, setList] = useState<ToastT[]>([])
  useEffect(() => {
    push = (t) => { const id = Date.now() + Math.random(); setList((l) => [...l, { ...t, id }]); setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4200) }
    return () => { push = null }
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg', t.tone === 'good' ? 'bg-navy text-snow dark:bg-snow dark:text-navy' : 'bg-bad text-white')}>{t.text}</div>
      ))}
    </div>
  )
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.')
