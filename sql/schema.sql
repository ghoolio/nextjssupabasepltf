create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  file_path text not null,
  thumbnail_path text,
  file_size bigint check (file_size is null or file_size > 0),
  duration_seconds integer,
  is_public boolean not null default true,
  payment_type text not null default 'free' check (payment_type in ('free', 'paid')),
  price_cents integer check (
    (payment_type = 'free' and price_cents is null)
    or (payment_type = 'paid' and price_cents >= 99)
  ),
  currency text check (
    (payment_type = 'free' and currency is null)
    or (payment_type = 'paid' and currency in ('EUR', 'USD'))
  ),
  created_at timestamptz not null default now()
);

create table if not exists video_purchases (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency in ('EUR', 'USD')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  provider text,
  provider_payment_id text,
  created_at timestamptz not null default now(),
  unique (video_id, buyer_id)
);

create table if not exists app_settings (
  id integer primary key default 1,
  platform_enabled boolean not null default true,
  payments_enabled boolean not null default true,
  maintenance_message text,
  updated_at timestamptz not null default now(),
  check (id = 1)
);

insert into app_settings (id, platform_enabled, payments_enabled, maintenance_message)
values (1, true, true, null)
on conflict (id) do nothing;

alter table profiles enable row level security;
alter table videos enable row level security;
alter table video_purchases enable row level security;
alter table app_settings enable row level security;

create policy "profiles_select_own" on profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
for update using (auth.uid() = id);

create policy "videos_public_or_owned_read" on videos
for select using (is_public = true or auth.uid() = user_id);

create policy "videos_insert_own" on videos
for insert with check (auth.uid() = user_id);

create policy "videos_update_own" on videos
for update using (auth.uid() = user_id);

create policy "videos_delete_own" on videos
for delete using (auth.uid() = user_id);

create policy "purchases_select_own_or_owner" on video_purchases
for select using (
  auth.uid() = buyer_id
  or exists (
    select 1 from videos v where v.id = video_purchases.video_id and v.user_id = auth.uid()
  )
);

create policy "purchases_insert_own" on video_purchases
for insert with check (auth.uid() = buyer_id);

create policy "app_settings_read_all" on app_settings
for select using (true);

-- Storage bucket notes:
-- 1. Create a PRIVATE bucket named: videos
-- 2. Allow uploads only to authenticated users' own folder, e.g. auth.uid()/filename
-- 3. Do not make the bucket public. Video delivery uses signed URLs.
