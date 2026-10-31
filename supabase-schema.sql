-- Vaishnavi Banquet: database setup for Supabase.
-- Run this ONCE: Supabase dashboard > SQL Editor > New query > paste all > Run.

create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.availability (
  day        date primary key,
  status     text not null check (status in ('available','booked','blocked')),
  note       text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  status       text not null default 'Pending' check (status in ('Pending','Confirmed','Cancelled')),
  name         text not null,
  phone        text not null,
  email        text not null default '',
  event_type   text not null,
  event_date   date not null,
  guests       integer not null check (guests > 0),
  package      text not null default '',
  budget       text not null default '',
  requirements text not null default '',
  admin_note   text not null default ''
);

create index if not exists enquiries_event_date_idx on public.enquiries (event_date);
create index if not exists enquiries_phone_date_idx on public.enquiries (phone, event_date);

-- Lock the tables: only the server (service role key) can read or write them.
alter table public.site_content enable row level security;
alter table public.availability enable row level security;
alter table public.enquiries    enable row level security;

-- Public storage bucket for website photos uploaded from the admin panel.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
