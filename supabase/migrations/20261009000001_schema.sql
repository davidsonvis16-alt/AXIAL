-- Axial core schema
-- Money is stored as numeric(14,2). Dates the user picks (billing dates,
-- transaction dates) are stored as plain `date` and interpreted in the
-- user's profile timezone.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  currency text not null default 'KES' check (char_length(currency) = 3),
  timezone text not null default 'Africa/Nairobi',
  budget_start_day smallint not null default 1 check (budget_start_day between 1 and 28),
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  reminder_defaults smallint[] not null default '{3,1}',
  notify_in_app boolean not null default true,
  notify_email boolean not null default false,
  notify_push boolean not null default false,
  hide_amounts boolean not null default false,
  custom_categories text[] not null default '{}',
  referral_code text unique not null default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  referred_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared spaces (declared early: other tables reference them)
-- ---------------------------------------------------------------------------
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'household' check (kind in ('couple', 'family', 'roommates', 'team', 'household')),
  currency text not null default 'KES',
  owner_id uuid not null references auth.users (id) on delete cascade,
  approval_threshold numeric(14,2),
  created_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create table public.space_expenses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 140),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Other',
  occurred_on date not null default current_date,
  paid_by uuid references auth.users (id) on delete set null,
  -- [{ "user_id": uuid, "share": numeric }]
  split jsonb not null default '[]',
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.space_activity (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'KES',
  category text not null default 'Other',
  description text not null check (char_length(description) between 1 and 140),
  occurred_on date not null,
  notes text,
  is_recurring boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'csv', 'demo')),
  import_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index transactions_import_hash_uq on public.transactions (user_id, import_hash) where import_hash is not null;
create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  period text not null default 'monthly' check (period in ('monthly', 'custom')),
  start_date date,
  end_date date,
  warn_at_pct smallint not null default 80 check (warn_at_pct between 1 and 100),
  created_at timestamptz not null default now(),
  check (period = 'monthly' or (start_date is not null and end_date is not null and end_date >= start_date))
);

-- ---------------------------------------------------------------------------
-- Savings vaults (tracked inside Axial — not bank deposits)
-- ---------------------------------------------------------------------------
create table public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'custom',
  goal_amount numeric(14,2) not null check (goal_amount > 0),
  target_date date,
  protected boolean not null default false,
  held_at text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.vault_entries (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'withdrawal')),
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  service_key text,
  category text not null default 'Entertainment',
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'KES',
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_billing_date date not null,
  payment_source text,
  notes text,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  reminder_days smallint[] not null default '{3,1}',
  manage_url text,
  started_on date,
  cancelled_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_due_idx on public.subscriptions (status, next_billing_date);

create table public.subscription_prices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null,
  previous_amount numeric(14,2),
  effective_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------
create table public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  type text not null check (type in (
    'save_percent_of_income', 'category_limit', 'budget_threshold', 'scheduled_saving',
    'subscription_price_increase', 'recurring_cap', 'shared_approval', 'protect_savings'
  )),
  threshold numeric(14,2),
  category text,
  vault_id uuid references public.vaults (id) on delete set null,
  frequency text not null default 'monthly' check (frequency in ('per_event', 'weekly', 'monthly')),
  notify_in_app boolean not null default true,
  notify_email boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rule_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  outcome text not null check (outcome in ('warning', 'allocation', 'info', 'ok')),
  message text not null,
  amount numeric(14,2),
  period_key text not null,
  created_at timestamptz not null default now(),
  unique (rule_id, period_key)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'rule', 'budget', 'price', 'shared', 'referral', 'system')),
  title text not null,
  body text not null default '',
  link text,
  dedupe_key text not null,
  read_at timestamptz,
  email_status text not null default 'skipped' check (email_status in ('skipped', 'pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_email_idx on public.notifications (email_status) where email_status = 'pending';

-- ---------------------------------------------------------------------------
-- Referrals and badges
-- ---------------------------------------------------------------------------
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'rejected')),
  reason text,
  points smallint not null default 0,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_user_id)
);

create table public.badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger transactions_touch before update on public.transactions for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();
create trigger rules_touch before update on public.rules for each row execute function public.touch_updated_at();
