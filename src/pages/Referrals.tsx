import { Award, CheckCircle2, Copy, Gift, Share2 } from 'lucide-react'
import { useApp } from '@/data/AppData'
import { Badge, Button, Card, Empty, Input, PageHeader, toast } from '@/ui/kit'
import { ago } from '@/ui/format'

const BADGES: Record<string, { name: string; how: string }> = {
  goal_reached: { name: 'Goal reached', how: 'Fill any savings vault to its goal.' },
  steady_tracker: { name: 'Steady tracker', how: 'Record transactions on 20 different days.' },
  no_surprises: { name: 'No surprises', how: 'Have reminders on for every active subscription.' },
  connector: { name: 'Connector', how: 'Have your first referral qualify.' },
}

export default function Referrals() {
  const { data, profile, userId } = useApp()
  const link = `${location.origin}/register?ref=${profile?.referral_code ?? ''}`
  const mine = data.referrals.filter((r) => r.referrer_id === userId)
  const points = mine.reduce((a, r) => a + r.points, 0)
  const earned = new Set(data.badges.map((b) => b.badge_key))
  return (
    <>
      <PageHeader title="Referrals and rewards" sub="Invite people who'd find Axial useful. Rewards are points and badges — they have no cash value." />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Your referral link">
          <div className="flex gap-2"><Input readOnly value={link} aria-label="Referral link" onFocus={(e) => e.target.select()} /><Button icon={<Copy className="h-4 w-4" />} onClick={() => { navigator.clipboard.writeText(link); toast.ok('Link copied') }}>Copy</Button></div>
          {typeof navigator.share === 'function' && <Button variant="secondary" size="sm" className="mt-2" icon={<Share2 className="h-4 w-4" />} onClick={() => navigator.share({ title: 'Axial', text: 'I track my money and subscriptions with Axial.', url: link }).catch(() => null)}>Share</Button>}
          <p className="mt-3 text-sm text-muted">Code: <b className="num text-ink">{profile?.referral_code}</b></p>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div><p className="num font-display text-2xl font-semibold">{mine.length}</p><p className="text-xs text-muted">Invited</p></div>
            <div><p className="num font-display text-2xl font-semibold">{mine.filter((r) => r.status === 'qualified').length}</p><p className="text-xs text-muted">Qualified</p></div>
            <div><p className="num font-display text-2xl font-semibold">{points}</p><p className="text-xs text-muted">Points</p></div>
          </div>
        </Card>
        <Card title="Reward rules">
          <ol className="space-y-3 text-sm">
            {['Someone signs up with your link and verifies their email.', 'They keep their account for at least 7 days.', 'They record 10 of their own transactions on at least 5 different days.', 'The referral qualifies and you get 100 points.'].map((s, i) => <li key={s} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sunken text-xs font-bold">{i + 1}</span>{s}</li>)}
          </ol>
          <p className="mt-4 text-xs text-muted">To prevent abuse: you can't refer yourself, each person can only be referred once, sample data doesn't count, and more than 10 sign-ups from one link in 24 hours are not rewarded. Checks run on the server daily.</p>
        </Card>
      </div>
      <Card className="mt-4" title="Referral history">
        {mine.length ? <ul className="-mx-2 divide-y divide-line">{mine.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-2 py-3 text-sm"><span>Referral #{mine.length - i}<span className="block text-xs text-muted">Signed up {ago(r.created_at)}{r.reason && ` · ${r.reason}`}</span></span>
            {r.status === 'qualified' ? <Badge tone="good"><CheckCircle2 className="h-3 w-3" />Qualified · +{r.points}</Badge> : r.status === 'pending' ? <Badge tone="warn">Pending</Badge> : <Badge tone="bad">Not eligible</Badge>}</li>
        ))}</ul> : <Empty icon={<Gift className="h-5 w-5" />} title="No referrals yet" body="Share your link. You'll see each sign-up here and when it qualifies." />}
      </Card>
      <Card className="mt-4" title="Badges">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(BADGES).map(([k, b]) => { const has = earned.has(k); return (
            <div key={k} className={`rounded-xl border p-4 ${has ? 'border-cyan/50 bg-cyan/5' : 'border-line opacity-70'}`}><Award className={`h-6 w-6 ${has ? 'text-cyan-ink' : 'text-muted'}`} /><p className="mt-2 font-semibold">{b.name}</p><p className="text-xs text-muted">{has ? `Earned ${ago(data.badges.find((x) => x.badge_key === k)!.earned_at)}` : b.how}</p></div>
          ) })}
        </div>
      </Card>
    </>
  )
}
