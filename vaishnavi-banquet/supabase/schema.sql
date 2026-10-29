-- ============================================================
-- VAISHNAVI BANQUET — DATABASE SCHEMA (Supabase / Postgres)
-- Run the WHOLE file once in: Supabase > SQL Editor > New query > Run.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Admin list ----------
-- A logged-in user is an admin only if their user id is in this table.
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- Halls ----------
create table if not exists halls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity int,                      -- NULL = not yet confirmed by the venue
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Bookings (enquiries + confirmed) ----------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  hall_id uuid references halls(id) on delete set null,
  event_date date not null,
  slot text not null check (slot in ('day','evening','full_day')),
  event_type text not null,
  customer_name text not null,
  phone text not null,
  email text,
  guests int,
  package_name text,
  requirements text,
  customer_notes text,
  internal_notes text,               -- owner only
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on bookings(event_date, status);

-- ---------- Blocked dates (maintenance / private events) ----------
create table if not exists blocked_dates (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid references halls(id) on delete cascade,
  block_date date not null,
  slot text not null default 'full_day' check (slot in ('day','evening','full_day')),
  reason text,                       -- private: never returned to the public
  created_at timestamptz not null default now()
);

-- ---------- Website content (key/value) ----------
create table if not exists site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Packages ----------
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_type text not null default 'enquiry' check (price_type in ('fixed','per_plate','enquiry')),
  price numeric,
  guest_limit int,
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  featured boolean not null default false,
  visible boolean not null default true,
  sort_order int not null default 0
);

-- ---------- Menu ----------
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  description text,
  is_veg boolean,
  price numeric,
  image_url text,
  available boolean not null default true,
  sort_order int not null default 0
);

-- ---------- Gallery ----------
create table if not exists gallery_images (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  category text,
  is_cover boolean not null default false,
  visible boolean not null default true,
  sort_order int not null default 0
);

-- ---------- Testimonials (website-only; NOT Google reviews) ----------
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text,                -- name or initials, ONLY with the customer's permission
  event_type text,
  event_date date,
  quote text not null,
  approved boolean not null default false,
  show_on_home boolean not null default false
);

-- ============================================================
-- HELPERS
-- ============================================================
create or replace function slots_overlap(a text, b text) returns boolean
language sql immutable as $$
  select a = 'full_day' or b = 'full_day' or a = b;
$$;

-- Keeps updated_at current and blocks confirming a conflicting booking.
create or replace function guard_booking() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if exists (
      select 1 from bookings b
      where b.id <> new.id and b.status = 'confirmed'
        and b.hall_id is not distinct from new.hall_id
        and b.event_date = new.event_date and slots_overlap(b.slot, new.slot)
    ) or exists (
      select 1 from blocked_dates d
      where d.hall_id is not distinct from new.hall_id
        and d.block_date = new.event_date and slots_overlap(d.slot, new.slot)
    ) then
      raise exception 'Conflict: this hall is already confirmed or blocked for that date and slot';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bookings_guard on bookings;
create trigger bookings_guard before insert or update on bookings
  for each row execute function guard_booking();

-- Stops the owner blocking a date that already has a confirmed booking.
create or replace function guard_block() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from bookings b
    where b.status = 'confirmed' and b.hall_id is not distinct from new.hall_id
      and b.event_date = new.block_date and slots_overlap(b.slot, new.slot)
  ) then
    raise exception 'Cannot block: a confirmed booking already exists for that date and slot';
  end if;
  return new;
end $$;
drop trigger if exists blocked_dates_guard on blocked_dates;
create trigger blocked_dates_guard before insert on blocked_dates
  for each row execute function guard_block();

-- ============================================================
-- PUBLIC FUNCTIONS (safe: return no names, phones or reasons)
-- ============================================================

-- Calendar data: one row per day and slot with state available | pending | unavailable
create or replace function get_availability(p_hall uuid, p_from date, p_to date)
returns table(day date, slot text, state text)
language sql stable security definer set search_path = public as $$
  with grid as (
    select d::date as day, s.slot as slot
    from generate_series(p_from, p_to, interval '1 day') d
    cross join unnest(array['day','evening']) as s(slot)
  )
  select g.day, g.slot,
    case
      when exists (select 1 from blocked_dates b
                   where b.hall_id is not distinct from p_hall and b.block_date = g.day
                     and slots_overlap(b.slot, g.slot))
        or exists (select 1 from bookings x
                   where x.hall_id is not distinct from p_hall and x.status = 'confirmed'
                     and x.event_date = g.day and slots_overlap(x.slot, g.slot))
        then 'unavailable'
      when exists (select 1 from bookings x
                   where x.hall_id is not distinct from p_hall and x.status = 'pending'
                     and x.event_date = g.day and slots_overlap(x.slot, g.slot))
        then 'pending'
      else 'available'
    end as state
  from grid g
  order by g.day, g.slot;
$$;

-- Customer enquiry. Always saved as PENDING. Never confirmed automatically.
create or replace function submit_enquiry(
  p_hall uuid, p_date date, p_slot text, p_event_type text,
  p_name text, p_phone text, p_email text, p_guests int,
  p_package text, p_requirements text, p_notes text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ref text;
begin
  -- Validation
  if char_length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Please enter a valid name'; end if;
  if coalesce(p_phone,'') !~ '^[0-9+ ]{10,15}$' then raise exception 'Please enter a valid phone number'; end if;
  if p_email is not null and p_email <> '' and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Please enter a valid email'; end if;
  if p_date < current_date or p_date > current_date + interval '2 years' then raise exception 'Please choose a date in the next two years'; end if;
  if p_slot not in ('day','evening','full_day') then raise exception 'Invalid time slot'; end if;
  if p_event_type not in ('Wedding','Reception','Engagement','Birthday','Anniversary','Other') then raise exception 'Invalid event type'; end if;
  if p_guests is not null and p_guests not between 1 and 10000 then raise exception 'Guest count looks wrong'; end if;
  if char_length(coalesce(p_requirements,'')) > 1000 or char_length(coalesce(p_notes,'')) > 1000 then raise exception 'Notes are too long'; end if;

  -- Re-check availability on the server (source of truth)
  if exists (
    select 1 from bookings b where b.status = 'confirmed'
      and b.hall_id is not distinct from p_hall and b.event_date = p_date and slots_overlap(b.slot, p_slot)
  ) or exists (
    select 1 from blocked_dates d where d.hall_id is not distinct from p_hall and d.block_date = p_date and slots_overlap(d.slot, p_slot)
  ) then
    raise exception 'Sorry, this date and slot is not available. Please choose another date.';
  end if;

  v_ref := 'VB' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 5));
  insert into bookings (reference, hall_id, event_date, slot, event_type, customer_name, phone, email,
                        guests, package_name, requirements, customer_notes, status)
  values (v_ref, p_hall, p_date, p_slot, p_event_type, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email,'')),''),
          p_guests, nullif(p_package,''), nullif(p_requirements,''), nullif(p_notes,''), 'pending');
  return v_ref;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table admins enable row level security;
alter table halls enable row level security;
alter table bookings enable row level security;
alter table blocked_dates enable row level security;
alter table site_content enable row level security;
alter table packages enable row level security;
alter table menu_items enable row level security;
alter table gallery_images enable row level security;
alter table testimonials enable row level security;

-- Drop old policies so the file can be re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy admins_self_read on admins for select using (user_id = auth.uid());

create policy halls_public_read on halls for select using (active or is_admin());
create policy halls_admin_write on halls for all using (is_admin()) with check (is_admin());

-- Bookings: NO public access at all. Customers only use submit_enquiry().
create policy bookings_admin_all on bookings for all using (is_admin()) with check (is_admin());

create policy blocked_admin_all on blocked_dates for all using (is_admin()) with check (is_admin());

create policy content_public_read on site_content for select using (true);
create policy content_admin_write on site_content for all using (is_admin()) with check (is_admin());

create policy packages_public_read on packages for select using (visible or is_admin());
create policy packages_admin_write on packages for all using (is_admin()) with check (is_admin());

create policy menu_public_read on menu_items for select using (true);
create policy menu_admin_write on menu_items for all using (is_admin()) with check (is_admin());

create policy gallery_public_read on gallery_images for select using (visible or is_admin());
create policy gallery_admin_write on gallery_images for all using (is_admin()) with check (is_admin());

create policy testimonials_public_read on testimonials for select using (approved or is_admin());
create policy testimonials_admin_write on testimonials for all using (is_admin()) with check (is_admin());

-- Public may run the two safe functions
grant execute on function get_availability(uuid, date, date) to anon, authenticated;
grant execute on function submit_enquiry(uuid, date, text, text, text, text, text, int, text, text, text) to anon, authenticated;
revoke execute on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

-- ============================================================
-- STORAGE: public gallery bucket, only admins can upload or delete
-- ============================================================
insert into storage.buckets (id, name, public) values ('gallery', 'gallery', true)
  on conflict (id) do update set public = true;

drop policy if exists gallery_public_read_obj on storage.objects;
drop policy if exists gallery_admin_insert_obj on storage.objects;
drop policy if exists gallery_admin_delete_obj on storage.objects;
create policy gallery_public_read_obj on storage.objects for select using (bucket_id = 'gallery');
create policy gallery_admin_insert_obj on storage.objects for insert with check (bucket_id = 'gallery' and is_admin());
create policy gallery_admin_delete_obj on storage.objects for delete using (bucket_id = 'gallery' and is_admin());

-- ============================================================
-- STARTER DATA (edit later in the admin dashboard)
-- ============================================================
insert into halls (name, capacity, description)
select 'Main Banquet Hall', null, 'Capacity and details to be confirmed by the venue.'
where not exists (select 1 from halls);

insert into site_content (key, value) values
  ('hero_title', '"Vaishnavi Banquet"'),
  ('hero_tagline', '"[Placeholder tagline — owner to replace]"'),
  ('about_text', '"[Placeholder about text — owner to replace with the venue''s own story.]"')
on conflict (key) do nothing;

-- ============================================================
-- ADMIN ACCOUNT
-- 1. Supabase > Authentication > Users > "Add user" > create the owner's email + password.
-- 2. Then run (replace the email) in SQL Editor:
--    insert into admins (user_id) select id from auth.users where email = 'owner@example.com'
--    on conflict do nothing;
-- ============================================================
