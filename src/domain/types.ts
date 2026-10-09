// Typed models that mirror the Supabase tables in supabase/migrations.

export type ISODate = string // yyyy-mm-dd
export type Timestamp = string // ISO 8601

export interface Profile {
  id: string
  full_name: string
  email: string | null
  currency: string
  timezone: string
  budget_start_day: number
  theme: 'light' | 'dark' | 'system'
  reminder_defaults: number[]
  notify_in_app: boolean
  notify_email: boolean
  notify_push: boolean
  hide_amounts: boolean
  custom_categories: string[]
  referral_code: string
  created_at: Timestamp
}

export type TxKind = 'income' | 'expense'
export type TxSource = 'manual' | 'csv' | 'demo'

export interface Transaction {
  id: string
  user_id: string
  kind: TxKind
  amount: number
  currency: string
  category: string
  description: string
  occurred_on: ISODate
  notes: string | null
  is_recurring: boolean
  source: TxSource
  import_hash: string | null
  created_at: Timestamp
}

export interface Budget {
  id: string
  user_id: string
  space_id: string | null
  category: string
  amount: number
  period: 'monthly' | 'custom'
  start_date: ISODate | null
  end_date: ISODate | null
  warn_at_pct: number
  created_at: Timestamp
}

export interface Vault {
  id: string
  user_id: string
  space_id: string | null
  name: string
  kind: string
  goal_amount: number
  target_date: ISODate | null
  protected: boolean
  held_at: string | null
  archived: boolean
  created_at: Timestamp
}

export interface VaultEntry {
  id: string
  vault_id: string
  user_id: string
  kind: 'deposit' | 'withdrawal'
  amount: number
  occurred_on: ISODate
  note: string | null
  created_at: Timestamp
}

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type SubStatus = 'active' | 'paused' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  name: string
  service_key: string | null
  category: string
  amount: number
  currency: string
  frequency: Frequency
  next_billing_date: ISODate
  payment_source: string | null
  notes: string | null
  status: SubStatus
  reminder_days: number[]
  manage_url: string | null
  started_on: ISODate | null
  cancelled_on: ISODate | null
  created_at: Timestamp
}

export interface SubscriptionPrice {
  id: string
  subscription_id: string
  user_id: string
  amount: number
  previous_amount: number | null
  effective_on: ISODate
  created_at: Timestamp
}

export type RuleType =
  | 'save_percent_of_income'
  | 'category_limit'
  | 'budget_threshold'
  | 'scheduled_saving'
  | 'subscription_price_increase'
  | 'recurring_cap'
  | 'shared_approval'
  | 'protect_savings'

export interface Rule {
  id: string
  user_id: string
  space_id: string | null
  name: string
  description: string
  type: RuleType
  threshold: number | null
  category: string | null
  vault_id: string | null
  frequency: 'per_event' | 'weekly' | 'monthly'
  notify_in_app: boolean
  notify_email: boolean
  active: boolean
  created_at: Timestamp
}

export interface RuleEvent {
  id: string
  rule_id: string
  user_id: string
  outcome: 'warning' | 'allocation' | 'info' | 'ok'
  message: string
  amount: number | null
  period_key: string
  created_at: Timestamp
}

export type NotificationKind = 'reminder' | 'rule' | 'budget' | 'price' | 'shared' | 'referral' | 'system'

export interface AppNotification {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string
  link: string | null
  dedupe_key: string
  read_at: Timestamp | null
  email_status: 'skipped' | 'pending' | 'sent' | 'failed'
  created_at: Timestamp
}

export interface Space {
  id: string
  name: string
  kind: 'couple' | 'family' | 'roommates' | 'team' | 'household'
  currency: string
  owner_id: string
  approval_threshold: number | null
  created_at: Timestamp
}

export type SpaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface SpaceMember {
  space_id: string
  user_id: string
  role: SpaceRole
  display_name: string
  joined_at: Timestamp
}

export interface SpaceInvite {
  id: string
  space_id: string
  email: string
  role: Exclude<SpaceRole, 'owner'>
  token: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  invited_by: string
  expires_at: Timestamp
  created_at: Timestamp
}

export interface SpaceExpense {
  id: string
  space_id: string
  created_by: string
  description: string
  amount: number
  category: string
  occurred_on: ISODate
  paid_by: string | null
  split: { user_id: string; share: number }[]
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: Timestamp | null
  created_at: Timestamp
}

export interface SpaceActivity {
  id: string
  space_id: string
  actor_id: string | null
  action: string
  detail: string
  created_at: Timestamp
}

export interface Referral {
  id: string
  referrer_id: string
  referred_user_id: string
  status: 'pending' | 'qualified' | 'rejected'
  reason: string | null
  points: number
  created_at: Timestamp
  qualified_at: Timestamp | null
}

export interface Badge {
  user_id: string
  badge_key: string
  earned_at: Timestamp
}

export interface Tables {
  transactions: Transaction
  budgets: Budget
  vaults: Vault
  vault_entries: VaultEntry
  subscriptions: Subscription
  subscription_prices: SubscriptionPrice
  rules: Rule
  rule_events: RuleEvent
  notifications: AppNotification
  spaces: Space
  space_members: SpaceMember
  space_invites: SpaceInvite
  space_expenses: SpaceExpense
  space_activity: SpaceActivity
  referrals: Referral
  badges: Badge
}
export type TableName = keyof Tables

export const DEFAULT_CATEGORIES = [
  'Food', 'Rent', 'Transport', 'Education', 'Entertainment', 'Subscriptions',
  'Shopping', 'Utilities', 'Business', 'Health', 'Other',
] as const
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Allowance', 'Gift', 'Other income'] as const
