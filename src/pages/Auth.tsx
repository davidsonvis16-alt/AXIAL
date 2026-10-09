import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { hasSupabase, supabase } from '@/data/supabase'
import { Logo } from '@/ui/brand'
import { Button, Field, Input, errMsg, toast } from '@/ui/kit'

function Frame({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" aria-label="Axial home"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <svg viewBox="0 0 600 800" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {[120, 190, 260, 330].map((r, i) => <ellipse key={r} cx="300" cy="420" rx={r} ry={r * 0.36} fill="none" stroke="#36D6F5" strokeOpacity={0.12 + i * 0.05} transform={`rotate(${-14 + i * 9} 300 420)`} />)}
          <circle cx="300" cy="420" r="7" fill="#36D6F5" />
        </svg>
        <p className="absolute bottom-12 left-12 right-12 font-display text-[34px] font-semibold leading-tight tracking-tight text-snow">Your money.<br />Centered.</p>
      </div>
    </div>
  )
}

function NoBackend() {
  const { startDemo } = useApp()
  const nav = useNavigate()
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4 text-sm">
      <p>Accounts need a Supabase project. Add <code className="rounded bg-sunken px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-sunken px-1">VITE_SUPABASE_ANON_KEY</code> to <code className="rounded bg-sunken px-1">.env</code> and restart the dev server.</p>
      <Button className="w-full" onClick={() => { startDemo(); nav('/app') }}>Explore the demo instead</Button>
    </div>
  )
}

// Without a backend, sign-up/sign-in open the browser-only demo using the details entered.
// Passwords are validated but never stored.
const pause = () => new Promise((r) => setTimeout(r, 700))
const nameFromEmail = (email: string) => email.split('@')[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'You'
const storedDemoName = (email: string): string | null => {
  try { const p = JSON.parse(localStorage.getItem('axial-demo:profile') ?? 'null'); return p?.email?.toLowerCase() === email.trim().toLowerCase() ? p.full_name : null } catch { return null }
}

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })
export function Login() {
  const { mode, startDemo } = useApp()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) })
  useEffect(() => { if (mode) nav(loc.state?.from ?? '/app', { replace: true }) }, [mode, nav, loc.state])
  const onSubmit = handleSubmit(async (v) => {
    if (!hasSupabase) {
      await pause()
      const known = storedDemoName(v.email)
      startDemo({ email: v.email.trim(), full_name: known ?? nameFromEmail(v.email) })
      toast.ok(`Welcome back${known ? `, ${known.split(' ')[0]}` : ''}`)
      return
    }
    const { error } = await supabase!.auth.signInWithPassword(v)
    if (error) toast.error(error.message.includes('Email not confirmed') ? 'Confirm your email first — check your inbox for the link.' : error.message)
  })
  return (
    <Frame title="Sign in" sub={<>New to Axial? <Link to="/register" className="font-semibold text-cyan-ink underline-offset-2 hover:underline">Create an account</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-[13px] text-muted hover:text-ink">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
        <Button type="button" variant="secondary" className="w-full" onClick={() => { startDemo(); nav('/app') }}>Explore with sample data</Button>
      </form>
    </Frame>
  )
}

const regSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(10, 'Use at least 10 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
  referral_code: z.string().trim().max(12).optional(),
})
export function Register() {
  const { startDemo } = useApp()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof regSchema>>({ resolver: zodResolver(regSchema), defaultValues: { referral_code: params.get('ref') ?? '' } })
  if (sentTo) return (
    <Frame title="Check your inbox">
      <div className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm"><MailCheck className="h-5 w-5 shrink-0 text-cyan-ink" /><p>We sent a confirmation link to <strong>{sentTo}</strong>. Open it to verify your email, then sign in.</p></div>
      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-cyan-ink">Back to sign in</Link>
    </Frame>
  )
  const onSubmit = handleSubmit(async (v) => {
    if (!hasSupabase) {
      await pause()
      startDemo({ full_name: v.full_name.trim(), email: v.email.trim() })
      toast.ok(`Welcome to Axial, ${v.full_name.trim().split(' ')[0]}`)
      nav('/app', { replace: true })
      return
    }
    const { error } = await supabase!.auth.signUp({ email: v.email, password: v.password, options: { emailRedirectTo: `${location.origin}/login`, data: { full_name: v.full_name, referral_code: v.referral_code || undefined } } })
    if (error) toast.error(error.message)
    else setSentTo(v.email)
  })
  return (
    <Frame title="Create your account" sub={<>Already have one? <Link to="/login" className="font-semibold text-cyan-ink hover:underline">Sign in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.full_name?.message}><Input autoComplete="name" {...register('full_name')} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters with a letter and a number."><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Referral code (optional)" error={errors.referral_code?.message}><Input {...register('referral_code')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </Frame>
  )
}

export function Forgot() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Frame title="Reset your password" sub="We'll email you a link to choose a new one.">
      {sent ? <p className="rounded-xl border border-line bg-surface p-4 text-sm">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p> : (
        <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); if (!hasSupabase) { await pause(); setBusy(false); setSent(true); return } const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/update-password` }); setBusy(false); if (error) toast.error(error.message); else setSent(true) }}>
          <Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-cyan-ink">Back to sign in</Link>
    </Frame>
  )
}

export function UpdatePassword() {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  if (!hasSupabase) return <Frame title="Choose a new password"><NoBackend /></Frame>
  return (
    <Frame title="Choose a new password">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault()
        if (pw.length < 10) return toast.error('Use at least 10 characters.')
        setBusy(true)
        const { error } = await supabase!.auth.updateUser({ password: pw })
        setBusy(false)
        if (error) toast.error(error.message); else { toast.ok('Password updated'); nav('/app') }
      }}>
        <Field label="New password" hint="At least 10 characters."><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button type="submit" className="w-full" loading={busy}>Update password</Button>
      </form>
    </Frame>
  )
}

export function InviteAccept() {
  const { token } = useParams()
  const { mode, rpc, profile } = useApp()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  if (mode !== 'live') return (
    <Frame title="Join a shared space" sub="Sign in with the email address the invitation was sent to, then open this link again.">
      <Link to="/login" state={{ from: `/invite/${token}` }}><Button className="w-full">Sign in</Button></Link>
    </Frame>
  )
  return (
    <Frame title="Join a shared space" sub="You'll see this space's shared budgets, goals and expenses. Your personal finances stay private.">
      <Button className="w-full" loading={busy} onClick={async () => {
        setBusy(true)
        try { await rpc('accept_space_invite', { p_token: token, p_display_name: profile?.full_name ?? '' }); toast.ok('You joined the space'); nav('/app/shared') }
        catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
      }}>Accept invitation</Button>
    </Frame>
  )
}
