-- Subscription reminders run on the database server every hour (pg_cron),
-- so they are created whether or not anyone has Axial open.
-- Each reminder has a dedupe key, so re-runs never create duplicates.

create extension if not exists pg_cron with schema extensions;

create or replace function public.advance_billing_date(p_date date, p_frequency text)
returns date language sql immutable as $$
  select case p_frequency
    when 'weekly' then p_date + 7
    when 'monthly' then (p_date + interval '1 month')::date
    when 'quarterly' then (p_date + interval '3 months')::date
    when 'yearly' then (p_date + interval '1 year')::date
  end
$$;

create or replace function public.generate_subscription_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare
  s record;
  d smallint;
  v_today date;
  v_next date;
  v_created int := 0;
  v_rows int;
begin
  for s in
    select sub.*, p.timezone, p.notify_email, p.notify_in_app
    from public.subscriptions sub
    join public.profiles p on p.id = sub.user_id
    where sub.status = 'active'
  loop
    v_today := (now() at time zone coalesce(s.timezone, 'UTC'))::date;

    -- Roll billing dates that have passed forward to the next cycle.
    v_next := s.next_billing_date;
    while v_next < v_today loop
      v_next := public.advance_billing_date(v_next, s.frequency);
    end loop;
    if v_next <> s.next_billing_date then
      update public.subscriptions set next_billing_date = v_next where id = s.id;
    end if;

    if not s.notify_in_app and not s.notify_email then continue; end if;

    foreach d in array s.reminder_days loop
      if v_next - d = v_today then
        insert into public.notifications (user_id, kind, title, body, link, dedupe_key, email_status)
        values (
          s.user_id, 'reminder',
          case when d = 0 then s.name || ' renews today' when d = 1 then s.name || ' renews tomorrow'
               else s.name || ' renews in ' || d || ' days' end,
          s.currency || ' ' || to_char(s.amount, 'FM999,999,990.00') || ' on ' || to_char(v_next, 'Dy DD Mon')
            || coalesce(' from ' || s.payment_source, '') || '. Axial does not charge or cancel this for you.',
          '/app/subscriptions',
          'sub:' || s.id || ':' || v_next || ':' || d,
          case when s.notify_email then 'pending' else 'skipped' end
        )
        on conflict (user_id, dedupe_key) do nothing;
        get diagnostics v_rows = row_count;
        v_created := v_created + v_rows;
      end if;
    end loop;
  end loop;
  return v_created;
end $$;

revoke execute on function public.generate_subscription_reminders() from public, anon, authenticated;

-- Hourly, five minutes past. Hourly runs cover every timezone's midnight.
select cron.schedule('axial-subscription-reminders', '5 * * * *', $$select public.generate_subscription_reminders()$$);
select cron.schedule('axial-referral-check', '20 3 * * *', $$select public.evaluate_referrals()$$);
