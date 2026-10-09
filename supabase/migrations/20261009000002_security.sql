-- Row Level Security, helper functions and server-side workflows.
-- Every table is locked down: a user sees their own rows, and shared-space
-- rows only while they are a member of that space.

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.space_role(p_space uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.space_members where space_id = p_space and user_id = auth.uid()
$$;

create or replace function public.is_space_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.space_members where space_id = p_space and user_id = auth.uid())
$$;

create or replace function public.can_write_space(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.space_role(p_space) in ('owner', 'admin', 'member'), false)
$$;

create or replace function public.can_manage_space(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.space_role(p_space) in ('owner', 'admin'), false)
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.space_expenses enable row level security;
alter table public.space_activity enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.vaults enable row level security;
alter table public.vault_entries enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_prices enable row level security;
alter table public.rules enable row level security;
alter table public.rule_events enable row level security;
alter table public.notifications enable row level security;
alter table public.referrals enable row level security;
alter table public.badges enable row level security;

-- Profiles: only yourself. Referral fields are not user-editable.
create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_fields() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_fields();

-- Personal tables
create policy "tx own" on public.transactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "subs own" on public.subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sub prices own" on public.subscription_prices for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.subscriptions s where s.id = subscription_id and s.user_id = auth.uid()));
create policy "notifications read own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications update own" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications delete own" on public.notifications for delete using (user_id = auth.uid());
create policy "notifications insert own" on public.notifications for insert with check (user_id = auth.uid());
create policy "badges read own" on public.badges for select using (user_id = auth.uid());
create policy "referrals read own" on public.referrals for select using (referrer_id = auth.uid() or referred_user_id = auth.uid());

-- Tables that may belong to a person or to a shared space
create policy "budgets read" on public.budgets for select
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.is_space_member(space_id)));
create policy "budgets insert" on public.budgets for insert
  with check (user_id = auth.uid() and (space_id is null or public.can_write_space(space_id)));
create policy "budgets update" on public.budgets for update
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_write_space(space_id)))
  with check ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_write_space(space_id)));
create policy "budgets delete" on public.budgets for delete
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_manage_space(space_id)));

create policy "vaults read" on public.vaults for select
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.is_space_member(space_id)));
create policy "vaults insert" on public.vaults for insert
  with check (user_id = auth.uid() and (space_id is null or public.can_write_space(space_id)));
create policy "vaults update" on public.vaults for update
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_write_space(space_id)))
  with check ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_write_space(space_id)));
create policy "vaults delete" on public.vaults for delete
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_manage_space(space_id)));

create policy "vault entries read" on public.vault_entries for select using (
  exists (select 1 from public.vaults v where v.id = vault_id and
    ((v.space_id is null and v.user_id = auth.uid()) or (v.space_id is not null and public.is_space_member(v.space_id)))));
create policy "vault entries insert" on public.vault_entries for insert with check (
  user_id = auth.uid() and exists (select 1 from public.vaults v where v.id = vault_id and
    ((v.space_id is null and v.user_id = auth.uid()) or (v.space_id is not null and public.can_write_space(v.space_id)))));
create policy "vault entries delete" on public.vault_entries for delete using (user_id = auth.uid());

create policy "rules read" on public.rules for select
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.is_space_member(space_id)));
create policy "rules write" on public.rules for all
  using ((space_id is null and user_id = auth.uid()) or (space_id is not null and public.can_manage_space(space_id)))
  with check (user_id = auth.uid() and (space_id is null or public.can_manage_space(space_id)));
create policy "rule events own" on public.rule_events for all using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (select 1 from public.rules r where r.id = rule_id and r.user_id = auth.uid()));

-- Spaces
create policy "spaces read" on public.spaces for select using (public.is_space_member(id) or owner_id = auth.uid());
create policy "spaces insert" on public.spaces for insert with check (owner_id = auth.uid());
create policy "spaces update" on public.spaces for update using (public.can_manage_space(id)) with check (public.can_manage_space(id));
create policy "spaces delete" on public.spaces for delete using (owner_id = auth.uid());

create policy "members read" on public.space_members for select using (public.is_space_member(space_id));
create policy "members manage" on public.space_members for update using (public.can_manage_space(space_id) and role <> 'owner')
  with check (public.can_manage_space(space_id) and role <> 'owner');
create policy "members remove" on public.space_members for delete
  using ((public.can_manage_space(space_id) and role <> 'owner') or (user_id = auth.uid() and role <> 'owner'));

create policy "invites read" on public.space_invites for select using (public.can_manage_space(space_id));
create policy "invites create" on public.space_invites for insert with check (public.can_manage_space(space_id) and invited_by = auth.uid());
create policy "invites revoke" on public.space_invites for update using (public.can_manage_space(space_id)) with check (public.can_manage_space(space_id));

create policy "expenses read" on public.space_expenses for select using (public.is_space_member(space_id));
create policy "expenses insert" on public.space_expenses for insert with check (created_by = auth.uid() and public.can_write_space(space_id));
create policy "expenses delete" on public.space_expenses for delete
  using ((created_by = auth.uid() and status = 'pending') or public.can_manage_space(space_id));
-- No update policy: status changes go through decide_space_expense().

create policy "activity read" on public.space_activity for select using (public.is_space_member(space_id));

-- ---------------------------------------------------------------------------
-- New user: profile + optional referral (anti-abuse checks live here)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(nullif(trim(new.raw_user_meta_data ->> 'referral_code'), ''));
  v_referrer uuid;
  v_recent int;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);

  if v_code is not null then
    select id into v_referrer from public.profiles where referral_code = v_code;
    if v_referrer is not null and v_referrer <> new.id then
      select count(*) into v_recent from public.referrals
        where referrer_id = v_referrer and created_at > now() - interval '24 hours';
      if v_recent >= 10 then
        insert into public.referrals (referrer_id, referred_user_id, status, reason)
        values (v_referrer, new.id, 'rejected', 'Too many sign-ups from this link in 24 hours');
      else
        insert into public.referrals (referrer_id, referred_user_id) values (v_referrer, new.id);
        update public.profiles set referred_by = v_referrer where id = new.id;
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Referral qualification: the invited person must verify their email, keep the
-- account for 7 days and record 10 transactions on 5 different days.
create or replace function public.evaluate_referrals() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0;
begin
  for r in
    select ref.id, ref.referrer_id, ref.referred_user_id
    from public.referrals ref
    join auth.users u on u.id = ref.referred_user_id
    where ref.status = 'pending'
      and u.email_confirmed_at is not null
      and u.created_at < now() - interval '7 days'
      and (select count(*) from public.transactions t where t.user_id = ref.referred_user_id and t.source <> 'demo') >= 10
      and (select count(distinct occurred_on) from public.transactions t where t.user_id = ref.referred_user_id and t.source <> 'demo') >= 5
  loop
    update public.referrals set status = 'qualified', qualified_at = now(), points = 100 where id = r.id;
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
      values (r.referrer_id, 'referral', 'A referral qualified', 'Someone you invited is now an active Axial user. 100 reward points were added.', '/app/referrals', 'referral:' || r.id)
      on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Spaces: creation, invites, approvals
-- ---------------------------------------------------------------------------
create or replace function public.create_space(p_name text, p_kind text, p_display_name text, p_threshold numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.spaces (name, kind, owner_id, approval_threshold)
    values (p_name, p_kind, auth.uid(), p_threshold) returning id into v_id;
  insert into public.space_members (space_id, user_id, role, display_name)
    values (v_id, auth.uid(), 'owner', coalesce(nullif(p_display_name, ''), 'Owner'));
  insert into public.space_activity (space_id, actor_id, action, detail) values (v_id, auth.uid(), 'created', p_name);
  return v_id;
end $$;

create or replace function public.accept_space_invite(p_token text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.space_invites; v_email text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.space_invites where token = p_token for update;
  if v_inv.id is null or v_inv.status <> 'pending' then raise exception 'This invitation is no longer valid'; end if;
  if v_inv.expires_at < now() then
    update public.space_invites set status = 'expired' where id = v_inv.id;
    raise exception 'This invitation has expired';
  end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'This invitation was sent to a different email address'; end if;
  insert into public.space_members (space_id, user_id, role, display_name)
    values (v_inv.space_id, auth.uid(), v_inv.role, coalesce(nullif(p_display_name, ''), split_part(v_email, '@', 1)))
    on conflict (space_id, user_id) do nothing;
  update public.space_invites set status = 'accepted' where id = v_inv.id;
  insert into public.space_activity (space_id, actor_id, action, detail) values (v_inv.space_id, auth.uid(), 'joined', p_display_name);
  return v_inv.space_id;
end $$;

-- Shared expenses above the space's approval threshold start as pending.
create or replace function public.space_expense_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_threshold numeric;
begin
  select approval_threshold into v_threshold from public.spaces where id = new.space_id;
  new.status := case when v_threshold is not null and new.amount >= v_threshold then 'pending' else 'approved' end;
  new.decided_by := null; new.decided_at := null;
  insert into public.space_activity (space_id, actor_id, action, detail)
    values (new.space_id, new.created_by, case when new.status = 'pending' then 'requested approval' else 'added expense' end,
            new.description || ' — ' || new.amount::text);
  return new;
end $$;
create trigger space_expense_defaults before insert on public.space_expenses for each row execute function public.space_expense_defaults();

create or replace function public.decide_space_expense(p_expense uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_exp public.space_expenses;
begin
  select * into v_exp from public.space_expenses where id = p_expense for update;
  if v_exp.id is null then raise exception 'Expense not found'; end if;
  if not public.can_write_space(v_exp.space_id) then raise exception 'You cannot approve expenses in this space'; end if;
  if v_exp.created_by = auth.uid() then raise exception 'Another member has to approve your own request'; end if;
  if v_exp.status <> 'pending' then raise exception 'This expense was already decided'; end if;
  update public.space_expenses
    set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now()
    where id = p_expense;
  insert into public.space_activity (space_id, actor_id, action, detail)
    values (v_exp.space_id, auth.uid(), case when p_approve then 'approved' else 'rejected' end, v_exp.description);
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (v_exp.created_by, 'shared', case when p_approve then 'Expense approved' else 'Expense declined' end,
            v_exp.description, '/app/shared', 'expense-decision:' || v_exp.id)
    on conflict do nothing;
end $$;

-- Badges are awarded by the server from stored records only.
create or replace function public.refresh_badges() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  -- First vault goal reached
  insert into public.badges (user_id, badge_key)
  select v_uid, 'goal_reached' where exists (
    select 1 from public.vaults v where v.user_id = v_uid and v.goal_amount <= (
      select coalesce(sum(case when e.kind = 'deposit' then e.amount else -e.amount end), 0)
      from public.vault_entries e where e.vault_id = v.id))
  on conflict do nothing;
  -- Recorded transactions on 20 different days
  insert into public.badges (user_id, badge_key)
  select v_uid, 'steady_tracker' where (
    select count(distinct occurred_on) from public.transactions where user_id = v_uid and source <> 'demo') >= 20
  on conflict do nothing;
  -- Every subscription has a reminder
  insert into public.badges (user_id, badge_key)
  select v_uid, 'no_surprises' where exists (select 1 from public.subscriptions where user_id = v_uid and status = 'active')
    and not exists (select 1 from public.subscriptions where user_id = v_uid and status = 'active' and cardinality(reminder_days) = 0)
  on conflict do nothing;
  -- First qualified referral
  insert into public.badges (user_id, badge_key)
  select v_uid, 'connector' where exists (select 1 from public.referrals where referrer_id = v_uid and status = 'qualified')
  on conflict do nothing;
end $$;

grant execute on function public.create_space(text, text, text, numeric) to authenticated;
grant execute on function public.accept_space_invite(text, text) to authenticated;
grant execute on function public.decide_space_expense(uuid, boolean) to authenticated;
grant execute on function public.refresh_badges() to authenticated;
revoke execute on function public.evaluate_referrals() from public, anon, authenticated;
