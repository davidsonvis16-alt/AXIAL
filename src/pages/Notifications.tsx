import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, CheckCheck, Gift, TrendingUp, Trash2, Users, Wallet, Workflow } from 'lucide-react'
import { useApp } from '@/data/AppData'
import type { NotificationKind } from '@/domain/types'
import { Button, Card, Empty, PageHeader, Segmented, errMsg, toast } from '@/ui/kit'
import { ago } from '@/ui/format'

const ICON: Record<NotificationKind, typeof Bell> = { reminder: CalendarClock, rule: Workflow, budget: Wallet, price: TrendingUp, shared: Users, referral: Gift, system: Bell }

export default function Notifications() {
  const { data, update, remove, userId } = useApp()
  const [filter, setFilter] = useState<'all' | 'unread' | 'reminder'>('all')
  const nav = useNavigate()
  const list = data.notifications.filter((n) => filter === 'all' || (filter === 'unread' ? !n.read_at : n.kind === 'reminder'))
  const unread = data.notifications.filter((n) => !n.read_at).length
  return (
    <>
      <PageHeader title="Notifications" sub="Subscription reminders, rule alerts and shared-space updates." actions={<Button size="sm" variant="secondary" className="h-9" icon={<CheckCheck className="h-4 w-4" />} disabled={!unread} onClick={async () => { try { await update('notifications', { user_id: userId!, read_at: null }, { read_at: new Date().toISOString() }); toast.ok('All marked as read') } catch (e) { toast.error(errMsg(e)) } }}>Mark all read</Button>} />
      <Segmented className="mb-4" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread ${unread}` }, { value: 'reminder', label: 'Reminder history' }]} />
      <Card pad={false}>
        {list.length ? <ul className="divide-y divide-line">{list.map((n) => { const I = ICON[n.kind]; return (
          <li key={n.id} className={`flex gap-3 px-5 py-4 ${n.read_at ? '' : 'bg-cyan/[.04]'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sunken text-muted"><I className="h-4 w-4" /></span>
            <button className="min-w-0 flex-1 text-left" onClick={async () => { if (!n.read_at) await update('notifications', { id: n.id }, { read_at: new Date().toISOString() }).catch(() => null); if (n.link) nav(n.link) }}>
              <p className="flex items-center gap-2 text-sm font-semibold">{!n.read_at && <span className="h-2 w-2 rounded-full bg-cyan" aria-label="Unread" />}{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              <p className="mt-1 text-xs text-muted">{ago(n.created_at)}{n.email_status === 'sent' && ' · emailed'}{n.email_status === 'failed' && ' · email failed'}</p>
            </button>
            <span className="flex shrink-0 items-start gap-0.5">
              <button className="rounded px-2 py-1 text-xs font-semibold text-muted hover:bg-sunken hover:text-ink" onClick={() => update('notifications', { id: n.id }, { read_at: n.read_at ? null : new Date().toISOString() }).catch((e) => toast.error(errMsg(e)))}>{n.read_at ? 'Mark unread' : 'Mark read'}</button>
              <button aria-label="Delete notification" className="rounded p-1.5 text-muted hover:bg-sunken hover:text-bad" onClick={() => remove('notifications', { id: n.id }).catch((e) => toast.error(errMsg(e)))}><Trash2 className="h-4 w-4" /></button>
            </span>
          </li>
        ) })}</ul> : <Empty icon={<Bell className="h-5 w-5" />} title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'} body="Reminders appear here before your subscriptions renew." />}
      </Card>
    </>
  )
}
