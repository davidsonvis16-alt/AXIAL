// Known services: official logo (Simple Icons CDN) and official page where the
// subscription is managed or cancelled. Axial links there; it does not cancel for you.
export interface ServiceInfo { key: string; name: string; icon: string | null; category: string; manage: string; how: string }

export const SERVICES: ServiceInfo[] = [
  { key: 'spotify', name: 'Spotify', icon: 'spotify', category: 'Entertainment', manage: 'https://www.spotify.com/account/subscription/', how: 'Account › Your plan › Change plan › Cancel Premium.' },
  { key: 'netflix', name: 'Netflix', icon: 'netflix', category: 'Entertainment', manage: 'https://www.netflix.com/cancelplan', how: 'Account › Membership › Cancel membership.' },
  { key: 'primevideo', name: 'Prime Video', icon: 'primevideo', category: 'Entertainment', manage: 'https://www.primevideo.com/settings', how: 'Account & Settings › Your account › End membership.' },
  { key: 'youtube', name: 'YouTube Premium', icon: 'youtube', category: 'Entertainment', manage: 'https://www.youtube.com/paid_memberships', how: 'Purchases and memberships › Manage membership › Deactivate.' },
  { key: 'googleone', name: 'Google One', icon: 'google', category: 'Cloud storage', manage: 'https://one.google.com/settings', how: 'Settings › Cancel membership. Play Store subscriptions: play.google.com › Subscriptions.' },
  { key: 'googleplay', name: 'Google Play subscription', icon: 'googleplay', category: 'Subscriptions', manage: 'https://play.google.com/store/account/subscriptions', how: 'Play Store › Profile › Payments & subscriptions › Subscriptions.' },
  { key: 'apple', name: 'Apple subscription', icon: 'apple', category: 'Subscriptions', manage: 'https://support.apple.com/en-us/118428', how: 'iPhone: Settings › your name › Subscriptions.' },
  { key: 'icloud', name: 'iCloud+', icon: 'icloud', category: 'Cloud storage', manage: 'https://support.apple.com/en-us/108047', how: 'Settings › your name › iCloud › Manage storage › Change plan.' },
  { key: 'microsoft365', name: 'Microsoft 365', icon: 'microsoft', category: 'Software', manage: 'https://account.microsoft.com/services', how: 'Services & subscriptions › Manage › Cancel subscription.' },
  { key: 'chatgpt', name: 'ChatGPT Plus', icon: 'openai', category: 'Software', manage: 'https://chatgpt.com/#settings/Subscription', how: 'Settings › Subscription › Cancel plan.' },
  { key: 'claude', name: 'Claude Pro', icon: 'claude', category: 'Software', manage: 'https://claude.ai/settings/billing', how: 'Settings › Billing › Cancel.' },
  { key: 'dropbox', name: 'Dropbox', icon: 'dropbox', category: 'Cloud storage', manage: 'https://www.dropbox.com/account/plan', how: 'Settings › Plan › Cancel plan.' },
  { key: 'xbox', name: 'Xbox Game Pass', icon: 'xbox', category: 'Gaming', manage: 'https://account.microsoft.com/services', how: 'Microsoft account › Services & subscriptions › Manage.' },
  { key: 'playstation', name: 'PlayStation Plus', icon: 'playstation', category: 'Gaming', manage: 'https://www.playstation.com/acct/management', how: 'Account management › Subscription management › Turn off auto-renew.' },
  { key: 'showmax', name: 'Showmax', icon: null, category: 'Entertainment', manage: 'https://www.showmax.com/account', how: 'Account › Manage subscription.' },
  { key: 'dstv', name: 'DStv', icon: null, category: 'Entertainment', manage: 'https://selfservice.dstv.com/', how: 'Self service › Manage subscription, or call your provider.' },
  { key: 'safaricom-home', name: 'Safaricom Home Fibre', icon: null, category: 'Internet', manage: 'https://www.safaricom.co.ke/personal/home-internet', how: 'Contact Safaricom or use the MySafaricom app to change your package.' },
  { key: 'gym', name: 'Gym membership', icon: null, category: 'Health', manage: '', how: 'Contact your gym in writing and keep the confirmation.' },
  { key: 'canva', name: 'Canva Pro', icon: 'canva', category: 'Software', manage: 'https://www.canva.com/settings/billing-and-teams', how: 'Settings › Billing & plans › Cancel subscription.' },
  { key: 'github', name: 'GitHub', icon: 'github', category: 'Software', manage: 'https://github.com/settings/billing', how: 'Settings › Billing and plans › Downgrade.' },
  { key: 'vercel', name: 'Vercel', icon: 'vercel', category: 'Business', manage: 'https://vercel.com/account/billing', how: 'Team settings › Billing › Downgrade.' },
]

export const serviceByKey = (k: string | null | undefined) => SERVICES.find((s) => s.key === k)
export const SUB_CATEGORIES = ['Entertainment', 'Cloud storage', 'Software', 'Gaming', 'Internet', 'Health', 'Business', 'Education', 'Subscriptions', 'Other']
