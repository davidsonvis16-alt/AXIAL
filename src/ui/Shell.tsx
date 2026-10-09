import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, ChevronsLeft, Gift, LayoutGrid, LogOut, Menu, Moon, PiggyBank, Receipt, Search, Settings, Sun, Users, Wallet, Workflow, X } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { Logo, LogoMark } from './brand'
import { cn } from './kit'

export const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/app/transactions', label: 'Transactions', icon: Receipt },
  { to: '/app/budgets', label: 'Budgets', icon: Wallet },
  { to: '/app/vaults', label: 'Savings vaults', icon: PiggyBank },
  { to: '/app/subscriptions', label: 'Subscriptions', icon: CalendarClock },
  { to: '/app/rules', label: 'Rules', icon: Workflow },
  { to: '/app/shared', label: 'Shared', icon: Users },
  { to: '/app/referrals', label: 'Referrals', icon: Gift },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const set = (d: boolean) => { document.documentElement.classList.toggle('dark', d); try { localStorage.setItem('axial-theme', d ? 'dark' : 'light') } catch { /* ignore */ } setDark(d) }
  return { dark, setDark: set }
}

export default function Shell() {
  const { mode, profile, data, signOut } = useApp()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('axial-sidebar') === '1' } catch { return false } })
  const [drawer, setDrawer] = useState(false)
  const { dark, setDark } = useTheme()
  const loc = useLocation()
  const nav = useNavigate()
  const unread = data.notifications.filter((n) => !n.read_at).length
  useEffect(() => setDrawer(false), [loc.pathname])
  useEffect(() => { try { localStorage.setItem('axial-sidebar', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])

  const side = (mobile = false) => (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed && !mobile && 'justify-center px-0')}>
        {collapsed && !mobile ? <LogoMark className="h-7 w-7 text-snow" /> : <span className="text-snow"><Logo /></span>}
      </div>
      <ul className="flex-1 space-y-0.5 px-2.5 py-2">
        {NAV.map(({ to, label, icon: I, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} title={collapsed && !mobile ? label : undefined}
              className={({ isActive }) => cn('relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors',
                isActive ? 'bg-white/[.09] text-snow' : 'text-slate hover:bg-white/[.05] hover:text-snow', collapsed && !mobile && 'justify-center px-0')}>
              {({ isActive }) => (<>
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-cyan" />}
                <I className="h-[18px] w-[18px] shrink-0" />
                {(!collapsed || mobile) && <span className="flex-1">{label}</span>}
                {label === 'Notifications' && unread > 0 && (!collapsed || mobile) && <span className="num rounded-full bg-cyan px-1.5 text-[11px] font-bold text-navy">{unread}</span>}
              </>)}
            </NavLink>
          </li>
        ))}
      </ul>
      {!mobile && (
        <button onClick={() => setCollapsed(!collapsed)} className="m-2.5 flex h-9 items-center justify-center gap-2 rounded-lg text-[13px] text-slate hover:bg-white/[.05] hover:text-snow" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <ChevronsLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />{!collapsed && 'Collapse'}
        </button>
      )}
    </nav>
  )

  return (
    <div className="min-h-screen bg-bg">
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden bg-navy lg:block transition-[width]', collapsed ? 'w-[68px]' : 'w-[232px]')}>{side()}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-navy/50" />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-navy" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-4 p-1 text-slate" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {side(true)}
          </aside>
        </div>
      )}
      <div className={cn('transition-[padding]', collapsed ? 'lg:pl-[68px]' : 'lg:pl-[232px]')}>
        {mode === 'demo' && (
          <div className="bg-warn/20 px-4 py-2 text-center text-[13px] text-ink">
            <strong>Demo mode.</strong> You're looking at sample data stored only in this browser — none of it is a real transaction.
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-1.5 text-muted hover:bg-sunken lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="lg:hidden"><LogoMark className="h-7 w-7" /></span>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setDark(!dark)} className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}</button>
            <button onClick={() => nav('/app/notifications')} className="relative rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-[18px] w-[18px]" />{unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan ring-2 ring-bg" />}
            </button>
            <ProfileMenu name={profile?.full_name || profile?.email || 'You'} onSignOut={async () => { await signOut(); nav('/') }} />
          </div>
        </header>
        <main className="mx-auto max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12"><Outlet /></main>
      </div>
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[NAV[0], NAV[1], NAV[4], NAV[3], NAV[8]].map(({ to, label, icon: I, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-ink' : 'text-muted')}>
            {({ isActive }) => (<><I className={cn('h-5 w-5', isActive && 'text-cyan-ink')} />{label.replace('Savings vaults', 'Vaults').replace('Subscriptions', 'Subs').replace('Notifications', 'Alerts')}</>)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function ProfileMenu({ name, onSignOut }: { name: string; onSignOut(): void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => { const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-deep font-display text-sm font-semibold text-snow">{name.slice(0, 1).toUpperCase()}</button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <p className="truncate px-3 py-2 text-sm font-semibold">{name}</p>
          <button role="menuitem" onClick={() => { setOpen(false); nav('/app/settings') }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sunken"><Settings className="h-4 w-4" />Settings</button>
          <button role="menuitem" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-bad hover:bg-sunken"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      )}
    </div>
  )
}

function GlobalSearch() {
  const { data } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return [
      ...NAV.filter((n) => n.label.toLowerCase().includes(s)).map((n) => ({ label: n.label, sub: 'Page', to: n.to })),
      ...data.subscriptions.filter((x) => x.name.toLowerCase().includes(s)).map((x) => ({ label: x.name, sub: 'Subscription', to: '/app/subscriptions' })),
      ...data.vaults.filter((x) => x.name.toLowerCase().includes(s)).map((x) => ({ label: x.name, sub: 'Vault', to: '/app/vaults' })),
      ...data.transactions.filter((x) => x.description.toLowerCase().includes(s)).slice(0, 5).map((x) => ({ label: x.description, sub: `Transaction · ${x.occurred_on}`, to: `/app/transactions?q=${encodeURIComponent(x.description)}` })),
    ].slice(0, 9)
  }, [q, data])
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search transactions, subscriptions…" aria-label="Search" className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-muted focus:border-cyan focus:outline-none" />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          {results.map((r, i) => (
            <li key={i}><button onMouseDown={() => { nav(r.to); setQ(''); setOpen(false) }} className="flex w-full flex-col px-3 py-2 text-left hover:bg-sunken"><span className="text-sm font-medium">{r.label}</span><span className="text-xs text-muted">{r.sub}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  )
}
