import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plug, X } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { supabase } from '@/data/supabase'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Toggle, errMsg, toast } from '@/ui/kit'
import { useTheme } from '@/ui/Shell'
import { download } from '@/ui/hooks'

const CURRENCIES = ['KES', 'UGX', 'TZS', 'RWF', 'NGN', 'ZAR', 'USD', 'EUR', 'GBP']
const TIMEZONES = ['Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Africa/Lagos', 'Africa/Johannesburg', 'Europe/London', 'America/New_York', 'UTC']

function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 py-3.5"><div className="min-w-0 max-w-md"><p className="text-sm font-semibold">{title}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>{children}</div>
}

export default function Settings() {
  const { profile, saveProfile, data, mode, resetDemo, signOut, session } = useApp()
  const { dark, setDark } = useTheme()
  const nav = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [newCat, setNewCat] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  if (!profile) return null
  const save = async (p: Parameters<typeof saveProfile>[0], msg = 'Settings saved') => { try { await saveProfile(p); toast.ok(msg) } catch (e) { toast.error(errMsg(e)) } }
  const pushState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <div className="space-y-4">
            <Field label="Name"><div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /><Button variant="secondary" disabled={name === profile.full_name} onClick={() => save({ full_name: name.trim() })}>Save</Button></div></Field>
            <Field label="Email"><Input value={session?.user.email ?? profile.email ?? ''} disabled /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency" hint="Totals include only this currency."><Select value={profile.currency} onChange={(e) => save({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Timezone" hint="Used for billing dates and reminders."><Select value={profile.timezone} onChange={(e) => save({ timezone: e.target.value })}>{TIMEZONES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </div>
            <Field label="Budget month starts on" hint="Useful if you're paid mid-month."><Select value={profile.budget_start_day} onChange={(e) => save({ budget_start_day: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1}</option>)}</Select></Field>
          </div>
        </Card>

        <Card title="Notifications">
          <div className="divide-y divide-line">
            <Row title="In-app notifications" sub="Reminders and alerts in your notification centre."><Toggle checked={profile.notify_in_app} onChange={(v) => save({ notify_in_app: v })} label="In-app notifications" /></Row>
            <Row title="Email notifications" sub={mode === 'demo' ? 'Not available in demo mode.' : 'Sent from the server once email delivery (Resend) is configured for this Axial deployment.'}><Toggle checked={profile.notify_email} onChange={(v) => mode !== 'demo' && save({ notify_email: v })} label="Email notifications" /></Row>
            <Row title="Browser notifications" sub={pushState === 'unsupported' ? 'This browser does not support notifications.' : pushState === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site to turn this on.' : 'Shown while Axial is open in this browser. Background push needs a push service, which is not set up.'}>
              <Toggle checked={profile.notify_push && pushState === 'granted'} onChange={async (v) => { if (!v) return save({ notify_push: false }); if (pushState === 'unsupported' || pushState === 'denied') return toast.error('Browser notifications are unavailable here'); const p = await Notification.requestPermission(); if (p === 'granted') save({ notify_push: true }, 'Browser notifications on'); else toast.error('Permission was not granted') }} label="Browser notifications" />
            </Row>
            <Row title="Default subscription reminders" sub="Applied to new subscriptions. You can change them per subscription.">
              <div className="flex flex-wrap gap-1.5">{[7, 3, 1, 0].map((d) => { const on = profile.reminder_defaults.includes(d); return <button key={d} aria-pressed={on} onClick={() => save({ reminder_defaults: on ? profile.reminder_defaults.filter((x) => x !== d) : [...profile.reminder_defaults, d].sort((a, b) => b - a) })} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${on ? 'border-cyan bg-cyan/15' : 'border-line text-muted'}`}>{d === 0 ? 'Same day' : `${d}d`}</button> })}</div>
            </Row>
          </div>
        </Card>

        <Card title="Appearance and privacy">
          <div className="divide-y divide-line">
            <Row title="Dark theme"><Toggle checked={dark} onChange={(v) => { setDark(v); save({ theme: v ? 'dark' : 'light' }, 'Theme updated') }} label="Dark theme" /></Row>
            <Row title="Hide amounts" sub="Mask balances on screen, for when someone is looking over your shoulder."><Toggle checked={profile.hide_amounts} onChange={(v) => save({ hide_amounts: v })} label="Hide amounts" /></Row>
          </div>
        </Card>

        <Card title="Custom categories">
          <div className="flex flex-wrap gap-2">{profile.custom_categories.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pl-3 pr-1.5 text-sm">{c}<button aria-label={`Remove ${c}`} className="rounded-full p-0.5 text-muted hover:text-bad" onClick={() => save({ custom_categories: profile.custom_categories.filter((x) => x !== c) })}><X className="h-3.5 w-3.5" /></button></span>)}{!profile.custom_categories.length && <p className="text-sm text-muted">None yet — add categories like "Church", "Chama" or "Pets".</p>}</div>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const c = newCat.trim(); if (c && !profile.custom_categories.includes(c)) save({ custom_categories: [...profile.custom_categories, c] }, 'Category added'); setNewCat('') }}><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" maxLength={30} /><Button type="submit" variant="secondary">Add</Button></form>
        </Card>

        <Card title="Connected integrations">
          <div className="divide-y divide-line">
            <Row title="CSV statement import" sub="Import bank or M-Pesa statements exported as CSV."><Badge tone="good">Available</Badge></Row>
            <Row title="Bank and card feeds" sub="Automatic transaction sync needs a licensed data provider. None is connected, so add transactions manually or by CSV."><Badge>Not connected</Badge></Row>
            <Row title="Subscription provider accounts" sub="Services like Google Play or Apple don't offer a way for Axial to read your subscriptions. Track them here and use the official management links."><Badge>Not available</Badge></Row>
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted"><Plug className="h-3.5 w-3.5" />Axial never asks for or stores banking passwords.</p>
        </Card>

        <Card title="Your data">
          <div className="divide-y divide-line">
            <Row title="Export everything" sub="All your records as a JSON file."><Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => download(`axial-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exported_at: new Date().toISOString(), profile, ...data }, null, 2), 'application/json')}>Download</Button></Row>
            {mode === 'demo' && <Row title="Reset sample data" sub="Restore the original demo records."><Button variant="secondary" size="sm" onClick={() => { resetDemo(); toast.ok('Demo data reset') }}>Reset</Button></Row>}
            <Row title={mode === 'demo' ? 'Leave demo' : 'Delete account'} sub={mode === 'demo' ? 'Clears sample data from this browser.' : 'Permanently deletes your account and every record. Spaces you own are deleted too.'}><Button variant="danger" size="sm" onClick={() => setDeleting(true)}>{mode === 'demo' ? 'Leave demo' : 'Delete account'}</Button></Row>
          </div>
        </Card>
      </div>

      <Modal open={deleting} onClose={() => setDeleting(false)} title={mode === 'demo' ? 'Leave demo?' : 'Delete your account?'}>
        <p className="text-sm text-muted">{mode === 'demo' ? 'Sample data in this browser will be cleared.' : 'This cannot be undone. Export your data first if you want a copy. Type DELETE to confirm.'}</p>
        {mode !== 'demo' && <Input className="mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type DELETE to confirm" />}
        <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(false)}>Cancel</Button><Button variant="danger" loading={busy} disabled={mode !== 'demo' && confirm !== 'DELETE'} onClick={async () => {
          setBusy(true)
          try {
            if (mode === 'demo') { Object.keys(localStorage).filter((k) => k.startsWith('axial-demo:')).forEach((k) => localStorage.removeItem(k)) }
            else { const { error } = await supabase!.functions.invoke('delete-account', { body: { confirm } }); if (error) throw error }
            await signOut(); nav('/')
          } catch (e) { toast.error(errMsg(e)) } finally { setBusy(false) }
        }}>{mode === 'demo' ? 'Leave demo' : 'Delete permanently'}</Button></div>
      </Modal>
    </>
  )
}
