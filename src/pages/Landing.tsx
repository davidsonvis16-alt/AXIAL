import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays } from 'date-fns'
import { Check, ChevronDown, Lock, Minus, ShieldCheck, Workflow } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { iso, upcomingBillings } from '@/domain/finance'
import type { Subscription } from '@/domain/types'
import { Logo, OrbitDial, ServiceLogo } from '@/ui/brand'
import { Button, Progress } from '@/ui/kit'

const sample = (name: string, key: string, amount: number, inDays: number): Subscription => ({
  id: key, user_id: '', name, service_key: key, category: 'Entertainment', amount, currency: 'KES', frequency: 'monthly',
  next_billing_date: iso(addDays(new Date(), inDays)), payment_source: null, notes: null, status: 'active', reminder_days: [3, 1],
  manage_url: null, started_on: null, cancelled_on: null, created_at: '',
})

export default function Landing() {
  const { startDemo, mode } = useApp()
  const nav = useNavigate()
  const today = iso(new Date())
  const subs = useMemo(() => [sample('Spotify', 'spotify', 299, 2), sample('Netflix', 'netflix', 1100, 6), sample('YouTube Premium', 'youtube', 459, 11), sample('ChatGPT Plus', 'chatgpt', 2600, 15), sample('Google One', 'googleone', 250, 19), sample('Microsoft 365', 'microsoft365', 650, 24), sample('Gym', 'gym', 2500, 27)], [])
  const occ = upcomingBillings(subs, today, 30)
  const demo = () => { startDemo(); nav('/app') }
  const primary = () => (mode ? nav('/app') : nav('/register'))

  return (
    <div className="bg-bg text-ink">
      <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#features" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:block">Features</a>
          <a href="#privacy" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:block">Privacy</a>
          <a href="#faq" className="hidden rounded-lg px-3 py-2 text-muted hover:text-ink sm:block">FAQ</a>
          {mode ? <Button size="sm" onClick={() => nav('/app')}>Open app</Button> : <><Link to="/login" className="rounded-lg px-3 py-2 font-semibold">Sign in</Link><Button size="sm" onClick={primary}>Get started</Button></>}
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1180px] items-center gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <h1 className="font-display text-[52px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[76px]">Your money.<br />Centered.</h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted">One place to understand your spending, track every subscription, protect your goals, and make confident financial decisions.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="h-12 px-6 text-[15px]" onClick={primary}>Get started</Button>
            <a href="#features"><Button variant="secondary" className="h-12 px-6 text-[15px]">Explore features</Button></a>
          </div>
          <button onClick={demo} className="mt-4 text-sm font-semibold text-cyan-ink underline-offset-4 hover:underline">Or try it with sample data — no sign-up</button>
        </div>
        <div className="relative mx-auto w-full max-w-[460px]">
          <OrbitDial occurrences={occ} today={today} centerLabel="Renewing this month" centerValue={`KES ${occ.reduce((a, o) => a + o.sub.amount, 0).toLocaleString()}`} size={460} />
          <p className="mt-1 text-center text-xs text-muted">Sample subscriptions, placed on the day each one renews.</p>
        </div>
      </section>

      <section id="features" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6">
          <h2 className="max-w-2xl font-display text-[34px] font-semibold leading-tight tracking-tight sm:text-[44px]">Stop checking five apps to find out what renews this week.</h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-semibold">Subscription command centre</h3>
              <p className="mt-2 max-w-md text-muted">Add Spotify, Netflix, your gym or anything recurring in seconds. See monthly and yearly cost, price changes, and a calendar of what's coming — with reminders 7, 3 or 1 day before, sent from our server even when Axial is closed.</p>
              <p className="mt-3 max-w-md text-sm text-muted">Axial links to each provider's official cancellation page. It never claims to cancel for you.</p>
            </div>
            <div className="rounded-2xl border border-line bg-bg p-4">
              {subs.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <ServiceLogo serviceKey={s.service_key} name={s.name} />
                  <div className="flex-1"><p className="font-medium">{s.name}</p><p className="text-xs text-muted">Renews in {Math.round((Date.parse(s.next_billing_date) - Date.parse(today)) / 864e5)} days · reminder 1 day before</p></div>
                  <p className="num font-semibold">KES {s.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 grid gap-10 lg:grid-cols-2">
            <div className="order-2 space-y-3 lg:order-1">
              {[['Pay myself first', 'Set aside 20% of every income you record', 'Records an intended saving'], ['Entertainment cap', 'Keep Entertainment under KES 5,000 a month', 'Warns you'], ['Price watch', 'Tell me when a subscription costs more than before', 'Warns you']].map(([n, d, e]) => (
                <div key={n} className="flex items-start gap-3 rounded-xl border border-line bg-bg p-4"><Workflow className="mt-0.5 h-5 w-5 text-cyan-ink" /><div className="flex-1"><p className="font-semibold">{n}</p><p className="text-sm text-muted">{d}</p></div><span className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-muted">{e}</span></div>
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="font-display text-xl font-semibold">Rules that keep you honest</h3>
              <p className="mt-2 max-w-md text-muted">Write the rules you'd like to follow and Axial checks every record against them. It tells you clearly whether a rule warns you or plans a saving — and it never pretends to move or block money in your bank.</p>
            </div>
          </div>

          <div className="mt-20 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-semibold">Savings vaults with a plan</h3>
              <p className="mt-2 max-w-md text-muted">Name a goal — emergency fund, next semester's fees, a laptop. Axial works out what to put aside each week or month, and when you'll get there at your current pace.</p>
            </div>
            <div className="rounded-2xl border border-line bg-bg p-5">
              {[['Emergency fund', 27000, 60000, true], ['Next semester fees', 27000, 48000, true], ['New laptop', 33000, 95000, false]].map(([n, b, g, p]) => (
                <div key={n as string} className="py-2.5"><div className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-1.5 font-medium">{n}{p && <Lock className="h-3.5 w-3.5 text-cyan-ink" />}</span><span className="num text-muted">KES {(b as number).toLocaleString()} / {(g as number).toLocaleString()}</span></div><Progress value={((b as number) / (g as number)) * 100} /></div>
              ))}
              <p className="mt-2 text-xs text-muted">Sample goals. Vaults record money you set aside; your bank holds it.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="bg-navy text-snow">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div><ShieldCheck className="h-8 w-8 text-cyan" /><h2 className="mt-4 font-display text-[34px] font-semibold leading-tight tracking-tight">Your records stay yours.</h2></div>
          <ul className="grid gap-6 sm:grid-cols-2">
            {[['Row-level security', 'Every database query is filtered to your account by the database itself, not just the app.'], ['No banking passwords', 'Axial never asks for bank, M-Pesa or card credentials. You add records yourself or import a CSV.'], ['Shared spaces are opt-in', 'Housemates or partners only see what is in the space you share — never your personal records.'], ['Export or delete anytime', 'Download everything as a file, or delete your account and all its data from Settings.']].map(([t, d]) => (
              <li key={t}><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-slate">{d}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6">
        <h2 className="font-display text-[30px] font-semibold tracking-tight">How it compares</h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left"><th className="p-4 font-semibold" /><th className="p-4 font-display font-semibold">Axial</th><th className="p-4 font-semibold text-muted">A spreadsheet</th><th className="p-4 font-semibold text-muted">Checking each app</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[['All subscriptions in one list', 1, 1, 0], ['Reminders before renewals', 1, 0, 0], ['Budgets with early warnings', 1, 1, 0], ['Goals with a contribution plan', 1, 0, 0], ['Split costs with housemates', 1, 0, 0], ['Works with no bank connection', 1, 1, 1]].map(([f, ...v]) => (
                <tr key={f as string}><td className="p-4">{f}</td>{v.map((x, i) => <td key={i} className="p-4">{x ? <Check className={`h-4 w-4 ${i === 0 ? 'text-cyan-ink' : 'text-muted'}`} aria-label="Yes" /> : <Minus className="h-4 w-4 text-line" aria-label="No" />}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[820px] px-4 pb-20 sm:px-6">
        <h2 className="font-display text-[30px] font-semibold tracking-tight">Questions</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {[
            ['Can Axial see my Google Play or Apple subscriptions automatically?', 'No. Those stores don\'t let third-party apps read your subscriptions. You add them in a few seconds, and Axial can also spot repeating charges in transactions you import.'],
            ['Does Axial move or lock my money?', 'No. Vaults and rules work on your records. When a rule says to set something aside, you move the money yourself and record it. Nothing in your bank changes.'],
            ['Can Axial cancel a subscription for me?', 'No. It shows each provider\'s official management page and how to cancel. After you cancel, mark it cancelled in Axial so reminders stop.'],
            ['Which currencies are supported?', 'Kenyan shillings by default. You can pick another currency in Settings and record transactions in any currency; totals use your main one.'],
            ['How do reminders reach me if the app is closed?', 'Reminders are created hourly on the server. You see them in the app, and by email once email delivery is set up for your Axial deployment.'],
          ].map(([q, a]) => <Faq key={q} q={q} a={a} />)}
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <h2 className="font-display text-[32px] font-semibold leading-tight tracking-tight">Know what's coming before it's charged.</h2>
          <div className="flex gap-3"><Button className="h-12 px-6" onClick={primary}>Get started</Button><Button variant="secondary" className="h-12 px-6" onClick={demo}>Try the demo</Button></div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
        <Logo />
        <p>Axial is a tracking and planning tool, not a bank or financial adviser. Logos belong to their owners.</p>
      </footer>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold" aria-expanded={open} onClick={() => setOpen(!open)}>{q}<ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} /></button>
      {open && <p className="pb-4 text-muted">{a}</p>}
    </div>
  )
}
