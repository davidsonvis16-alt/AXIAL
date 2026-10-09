-- Employer payroll: workers and recorded pay runs.
-- Axial records pay runs and payslips; money is sent through M-Pesa or the bank.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 1),
  role text,
  phone text,
  kra_pin text,
  pay_method text not null default 'mpesa' check (pay_method in ('mpesa', 'bank', 'cash')),
  bank_account text,
  gross_salary numeric(14,2) not null check (gross_salary > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  paid_on date not null default current_date,
  lines jsonb not null default '[]',
  total_gross numeric(14,2) not null,
  total_net numeric(14,2) not null,
  employer_cost numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create index employees_user_idx on public.employees (user_id);
create index payroll_runs_user_idx on public.payroll_runs (user_id, period desc);

alter table public.employees enable row level security;
alter table public.payroll_runs enable row level security;
create policy "employees own" on public.employees for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "payroll runs own" on public.payroll_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
