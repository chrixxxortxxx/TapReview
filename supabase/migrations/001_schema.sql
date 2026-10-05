-- TapReview schema for Supabase (PostgreSQL 15+)
-- Run in the Supabase SQL editor, or with `supabase db push`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'business');
create type public.member_role as enum ('owner', 'staff');
create type public.card_status as enum ('active', 'inactive', 'suspended', 'lost', 'replaced');
create type public.event_type as enum ('NFC_TAP', 'QR_SCAN', 'LANDING_PAGE_VIEW', 'GOOGLE_REVIEW_CLICK');

-- ---------------------------------------------------------------------------
-- Location reference
-- ---------------------------------------------------------------------------
create table public.regions (
  code text primary key,
  name text not null,
  short_name text not null,
  sort int not null default 0
);

create table public.provinces (
  id serial primary key,
  region_code text not null references public.regions(code),
  name text not null,
  unique (region_code, name)
);

create table public.cities (
  id serial primary key,
  province_id int not null references public.provinces(id),
  name text not null,
  lat double precision,
  lng double precision,
  unique (province_id, name)
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role public.app_role not null default 'business',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text unique,
  category text,
  description text check (char_length(description) <= 1000),
  logo_url text,
  cover_url text,
  phone text,
  email text,
  website text,
  facebook_url text,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'pending', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses (owner_id);
create index businesses_name_idx on public.businesses (lower(name));

create table public.business_users (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'staff',
  branch_ids uuid[],               -- null = all branches (staff); ignored for owners
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_users_user_idx on public.business_users (user_id);

create table public.review_destinations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  label text not null default 'Google Reviews',
  url text not null check (url ~* '^https://'),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index review_destinations_default_idx on public.review_destinations (business_id) where is_default;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  address text,
  barangay text,
  city text not null,
  province text not null,
  region_code text not null references public.regions(code),
  lat double precision not null check (lat between 4 and 22),
  lng double precision not null check (lng between 116 and 128),
  phone text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);
create index branches_business_idx on public.branches (business_id);
create index branches_region_idx on public.branches (region_code, province, city);

-- ---------------------------------------------------------------------------
-- NFC cards
-- ---------------------------------------------------------------------------
create sequence public.nfc_card_seq;

create table public.nfc_cards (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  nfc_uid text unique,
  public_token text not null unique,
  card_name text not null default 'Review Card',
  card_type text not null default 'Card',
  status public.card_status not null default 'inactive',
  business_id uuid references public.businesses(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  review_destination_id uuid references public.review_destinations(id) on delete set null,
  manufacturer text,
  tag_type text,
  material text,
  purchase_batch text,
  purchase_date date,
  notes text,
  photo_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  last_used_at timestamptz,
  replaced_by uuid references public.nfc_cards(id),
  replaces uuid references public.nfc_cards(id),
  check (branch_id is null or business_id is not null)
);
create index nfc_cards_business_idx on public.nfc_cards (business_id);
create index nfc_cards_branch_idx on public.nfc_cards (branch_id);
create index nfc_cards_status_idx on public.nfc_cards (status);

create table public.nfc_card_assignments (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.nfc_cards(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  previous_business_id uuid references public.businesses(id) on delete set null,
  previous_branch_id uuid references public.branches(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now()
);
create index nfc_card_assignments_card_idx on public.nfc_card_assignments (card_id, assigned_at desc);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.nfc_cards(id) on delete cascade,
  path text not null,                -- e.g. /t/8FJ29KD3QX?src=qr (prefix with the public base URL)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics (anonymous; no customer location or identity is stored)
-- ---------------------------------------------------------------------------
create table public.interaction_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.nfc_cards(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  event_type public.event_type not null,
  created_at timestamptz not null default now(),
  user_agent text,
  device_type text,
  browser text,
  referrer text
);
create index interaction_events_card_idx on public.interaction_events (card_id, created_at desc);
create index interaction_events_business_idx on public.interaction_events (business_id, created_at desc);

-- Daily roll-up maintained by trigger; all dashboards read from here.
create table public.card_daily_stats (
  card_id uuid not null references public.nfc_cards(id) on delete cascade,
  day date not null,
  business_id uuid references public.businesses(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  nfc int not null default 0,
  qr int not null default 0,
  views int not null default 0,
  clicks int not null default 0,
  primary key (card_id, day)
);
create index card_daily_stats_day_idx on public.card_daily_stats (day);
create index card_daily_stats_business_idx on public.card_daily_stats (business_id, day);

-- ---------------------------------------------------------------------------
-- Audit, notifications, subscriptions
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  card_id uuid references public.nfc_cards(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_card_idx on public.audit_logs (card_id, created_at desc);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  card_limit int,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Permission helpers (security definer so they can be used inside RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

create or replace function public.is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_users bu join profiles p on p.id = bu.user_id
    where bu.business_id = p_business and bu.user_id = auth.uid() and p.is_active
  );
$$;

create or replace function public.is_owner(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_users bu join profiles p on p.id = bu.user_id
    where bu.business_id = p_business and bu.user_id = auth.uid() and bu.role = 'owner' and p.is_active
  );
$$;

-- True if the current user may see/manage data for the given branch of a business.
create or replace function public.can_access_branch(p_business uuid, p_branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from business_users bu join profiles p on p.id = bu.user_id
    where bu.business_id = p_business and bu.user_id = auth.uid() and p.is_active
      and (bu.role = 'owner' or bu.branch_ids is null or p_branch = any (bu.branch_ids))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.provinces enable row level security;
alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.review_destinations enable row level security;
alter table public.branches enable row level security;
alter table public.nfc_cards enable row level security;
alter table public.nfc_card_assignments enable row level security;
alter table public.qr_codes enable row level security;
alter table public.interaction_events enable row level security;
alter table public.card_daily_stats enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;

create policy "geo readable" on public.regions for select using (true);
create policy "geo readable" on public.provinces for select using (true);
create policy "geo readable" on public.cities for select using (true);

create policy "profiles self or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin()
         or exists (select 1 from business_users a join business_users b on a.business_id = b.business_id
                    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy "profiles self or admin update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "businesses read" on public.businesses for select to authenticated
  using (public.is_admin() or public.is_member(id));
create policy "businesses update" on public.businesses for update to authenticated
  using (public.is_admin() or public.is_owner(id)) with check (public.is_admin() or public.is_owner(id));
create policy "businesses admin insert" on public.businesses for insert to authenticated with check (public.is_admin());
create policy "businesses admin delete" on public.businesses for delete to authenticated using (public.is_admin());

create policy "members read" on public.business_users for select to authenticated
  using (public.is_admin() or public.is_member(business_id));
create policy "members manage" on public.business_users for all to authenticated
  using (public.is_admin() or public.is_owner(business_id)) with check (public.is_admin() or public.is_owner(business_id));

create policy "destinations read" on public.review_destinations for select to authenticated
  using (public.is_admin() or public.is_member(business_id));
create policy "destinations manage" on public.review_destinations for all to authenticated
  using (public.is_admin() or public.is_owner(business_id)) with check (public.is_admin() or public.is_owner(business_id));

create policy "branches read" on public.branches for select to authenticated
  using (public.can_access_branch(business_id, id));
create policy "branches manage" on public.branches for all to authenticated
  using (public.is_admin() or public.is_owner(business_id)) with check (public.is_admin() or public.is_owner(business_id));

create policy "cards read" on public.nfc_cards for select to authenticated
  using (public.is_admin() or (business_id is not null and public.can_access_branch(business_id, branch_id)));
create policy "cards insert" on public.nfc_cards for insert to authenticated
  with check (public.is_admin() or (business_id is not null and public.is_owner(business_id)));
create policy "cards update" on public.nfc_cards for update to authenticated
  using (public.is_admin() or (business_id is not null and public.can_access_branch(business_id, branch_id)))
  with check (public.is_admin() or (business_id is not null and public.can_access_branch(business_id, branch_id)));
create policy "cards admin delete" on public.nfc_cards for delete to authenticated using (public.is_admin());

create policy "assignments read" on public.nfc_card_assignments for select to authenticated
  using (public.is_admin() or (business_id is not null and public.is_member(business_id)));

create policy "qr read" on public.qr_codes for select to authenticated
  using (exists (select 1 from nfc_cards c where c.id = card_id));

create policy "events read" on public.interaction_events for select to authenticated
  using (public.is_admin() or (business_id is not null and public.can_access_branch(business_id, branch_id)));

create policy "daily stats read" on public.card_daily_stats for select to authenticated
  using (public.is_admin() or (business_id is not null and public.can_access_branch(business_id, branch_id)));

create policy "audit read" on public.audit_logs for select to authenticated
  using (public.is_admin() or (business_id is not null and public.is_member(business_id)));

create policy "notifications own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions read" on public.subscriptions for select to authenticated
  using (public.is_admin() or public.is_owner(business_id));
create policy "subscriptions admin" on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Views (security_invoker => RLS of the caller applies)
-- ---------------------------------------------------------------------------
create view public.card_totals with (security_invoker = true) as
  select card_id,
         sum(nfc)::int as taps,
         sum(qr)::int as scans,
         sum(views)::int as views,
         sum(clicks)::int as clicks,
         max(day) as last_day
  from public.card_daily_stats
  group by card_id;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.random_token(len int default 10) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := gen_random_bytes(len);
  out text := '';
begin
  for i in 0 .. len - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from profiles where role = 'admin' and is_active;
$$;

create or replace function public.notify_business(p_business uuid, p_type text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link)
  select user_id, p_type, p_title, p_body, p_link from business_users where business_id = p_business;
$$;

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id uuid, p_card uuid, p_business uuid, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, actor_email, action, entity_type, entity_id, card_id, business_id, details)
  values (auth.uid(), (select email from profiles where id = auth.uid()), p_action, p_entity, p_entity_id, p_card, p_business, coalesce(p_details, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change roles / activation.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active or new.email is distinct from old.email)
     and not public.is_admin() and auth.uid() is not null then
    raise exception 'Only administrators can change role, status or email';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

create or replace function public.touch_business() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status and not public.is_admin() and auth.uid() is not null then
    raise exception 'Only administrators can change business status';
  end if;
  return new;
end $$;
create trigger touch_business before update on public.businesses
  for each row execute function public.touch_business();

-- Branch must belong to the card's business.
create or replace function public.check_card_branch() returns trigger language plpgsql as $$
begin
  if new.branch_id is not null and not exists (select 1 from branches where id = new.branch_id and business_id = new.business_id) then
    raise exception 'Branch does not belong to the selected business';
  end if;
  if new.review_destination_id is not null and not exists (select 1 from review_destinations where id = new.review_destination_id and business_id = new.business_id) then
    raise exception 'Review destination does not belong to the selected business';
  end if;
  return new;
end $$;

create or replace function public.before_card_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Identifiers are always server-generated for API callers. (Direct SQL seeding without a JWT may preset them.)
  if auth.uid() is not null or new.card_code is null then
    new.card_code := 'TR-NFC-' || lpad(nextval('nfc_card_seq')::text, 6, '0');
  end if;
  if auth.uid() is not null or new.public_token is null then
    new.public_token := public.random_token(10);
  end if;
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.created_at := now();
    new.replaced_by := null;
  end if;
  if new.business_id is not null and new.assigned_at is null then new.assigned_at := now(); end if;
  if new.status = 'active' then
    if new.business_id is null then raise exception 'Assign a business before activating a card'; end if;
    new.activated_at := case when auth.uid() is null then coalesce(new.activated_at, now()) else now() end;
  end if;
  if new.status in ('replaced') and auth.uid() is not null then raise exception 'Use replace_card() to replace cards'; end if;
  return new;
end $$;
create trigger before_card_insert before insert on public.nfc_cards
  for each row execute function public.before_card_insert();
create trigger check_card_branch before insert or update on public.nfc_cards
  for each row execute function public.check_card_branch();

create or replace function public.before_card_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.card_code <> old.card_code or new.public_token <> old.public_token or new.created_at <> old.created_at
     or new.replaced_by is distinct from old.replaced_by and current_setting('tapreview.replacing', true) is distinct from 'on' then
    raise exception 'Card identifiers cannot be changed';
  end if;
  if not public.is_admin() and auth.uid() is not null then
    if new.business_id is distinct from old.business_id then raise exception 'Only administrators can reassign cards to another business'; end if;
    if new.status = 'suspended' and old.status <> 'suspended' then raise exception 'Only administrators can suspend cards'; end if;
    if old.status = 'suspended' and new.status <> 'suspended' then raise exception 'This card was suspended by an administrator'; end if;
    if new.nfc_uid is distinct from old.nfc_uid and old.nfc_uid is not null then raise exception 'Only administrators can change a recorded NFC UID'; end if;
  end if;
  if old.status = 'replaced' and new.status <> 'replaced' then raise exception 'Replaced cards cannot be reactivated'; end if;
  if new.status = 'replaced' and old.status <> 'replaced' and current_setting('tapreview.replacing', true) is distinct from 'on' then
    raise exception 'Use replace_card() to replace cards';
  end if;
  if new.status = 'active' and new.business_id is null then raise exception 'Assign a business before activating a card'; end if;
  if new.business_id is null then new.branch_id := null; end if;

  if new.status is distinct from old.status then
    if new.status = 'active' then new.activated_at := now(); new.deactivated_at := null;
    else new.deactivated_at := now(); end if;
  end if;
  if new.business_id is distinct from old.business_id or new.branch_id is distinct from old.branch_id then
    new.assigned_at := case when new.business_id is null then null else now() end;
    if new.business_id is distinct from old.business_id then new.review_destination_id := null; end if;
  end if;
  return new;
end $$;
create trigger before_card_update before update on public.nfc_cards
  for each row execute function public.before_card_update();

create or replace function public.after_card_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  biz_old text; biz_new text; br_old text; br_new text;
begin
  if tg_op = 'INSERT' then
    insert into qr_codes (card_id, path) values (new.id, '/t/' || new.public_token || '?src=qr');
    perform write_audit('card.created', 'card', new.id, new.id, new.business_id, jsonb_build_object('card_code', new.card_code, 'replaces', (select card_code from nfc_cards where id = new.replaces)));
    if new.business_id is not null then
      insert into nfc_card_assignments (card_id, business_id, branch_id, assigned_by) values (new.id, new.business_id, new.branch_id, auth.uid());
      perform notify_business(new.business_id, 'card.assigned', 'New NFC card assigned', new.card_code || ' — ' || new.card_name, '/app/cards/' || new.id);
    end if;
    return new;
  end if;

  if new.business_id is distinct from old.business_id or new.branch_id is distinct from old.branch_id then
    select name into biz_old from businesses where id = old.business_id;
    select name into biz_new from businesses where id = new.business_id;
    select name into br_old from branches where id = old.branch_id;
    select name into br_new from branches where id = new.branch_id;
    insert into nfc_card_assignments (card_id, business_id, branch_id, previous_business_id, previous_branch_id, assigned_by)
      values (new.id, new.business_id, new.branch_id, old.business_id, old.branch_id, auth.uid());
    perform write_audit(case when old.business_id is null then 'card.assigned' else 'card.reassigned' end, 'card', new.id, new.id, coalesce(new.business_id, old.business_id),
      jsonb_build_object('from_business', biz_old, 'from_branch', br_old, 'to_business', biz_new, 'to_branch', br_new));
    if new.business_id is not null and new.business_id is distinct from old.business_id then
      perform notify_business(new.business_id, 'card.assigned', 'New NFC card assigned', new.card_code || ' — ' || new.card_name, '/app/cards/' || new.id);
    end if;
  end if;

  if new.status is distinct from old.status and new.status <> 'replaced' then
    perform write_audit('card.status_changed', 'card', new.id, new.id, new.business_id, jsonb_build_object('from', old.status, 'to', new.status));
    if new.business_id is not null then
      perform notify_business(new.business_id, 'card.' || new.status, 'Card ' || new.status, new.card_code || ' is now ' || new.status, '/app/cards/' || new.id);
    end if;
    if new.status = 'lost' then
      perform notify_admins('card.lost', 'Card reported lost', new.card_code || coalesce(' — ' || biz_new, ''), '/admin/cards/' || new.id);
    end if;
  end if;

  if (new.card_name, new.card_type, new.nfc_uid, new.notes, new.manufacturer, new.tag_type, new.material, new.purchase_batch, new.review_destination_id)
     is distinct from (old.card_name, old.card_type, old.nfc_uid, old.notes, old.manufacturer, old.tag_type, old.material, old.purchase_batch, old.review_destination_id) then
    perform write_audit('card.updated', 'card', new.id, new.id, new.business_id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger after_card_change after insert or update on public.nfc_cards
  for each row execute function public.after_card_change();

-- Roll events up into card_daily_stats and stamp last_used_at.
create or replace function public.after_event_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into card_daily_stats (card_id, day, business_id, branch_id, nfc, qr, views, clicks)
  values (new.card_id, (new.created_at at time zone 'Asia/Manila')::date, new.business_id, new.branch_id,
          (new.event_type = 'NFC_TAP')::int, (new.event_type = 'QR_SCAN')::int,
          (new.event_type = 'LANDING_PAGE_VIEW')::int, (new.event_type = 'GOOGLE_REVIEW_CLICK')::int)
  on conflict (card_id, day) do update set
    nfc = card_daily_stats.nfc + excluded.nfc,
    qr = card_daily_stats.qr + excluded.qr,
    views = card_daily_stats.views + excluded.views,
    clicks = card_daily_stats.clicks + excluded.clicks;
  update nfc_cards set last_used_at = new.created_at where id = new.card_id and (last_used_at is null or last_used_at < new.created_at);
  return new;
end $$;
create trigger after_event_insert after insert on public.interaction_events
  for each row execute function public.after_event_insert();

create or replace function public.after_business_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform write_audit('business.created', 'business', new.id, null, new.id, jsonb_build_object('name', new.name));
  perform notify_admins('business.registered', 'New business registration', new.name, '/admin/restaurants/' || new.id);
  return new;
end $$;
create trigger after_business_insert after insert on public.businesses
  for each row execute function public.after_business_insert();

-- ---------------------------------------------------------------------------
-- RPC: public card visit (anonymous). Only returns public landing-page data.
-- ---------------------------------------------------------------------------
create or replace function public.parse_device(p_ua text) returns text language sql immutable as $$
  select case when p_ua ~* 'ipad|tablet' then 'tablet' when p_ua ~* 'mobi|iphone|android' then 'mobile' else 'desktop' end;
$$;
create or replace function public.parse_browser(p_ua text) returns text language sql immutable as $$
  select case when p_ua ~* 'edg/' then 'Edge' when p_ua ~* 'samsungbrowser' then 'Samsung Internet' when p_ua ~* 'fbav|fban' then 'Facebook'
              when p_ua ~* 'crios|chrome' then 'Chrome' when p_ua ~* 'fxios|firefox' then 'Firefox' when p_ua ~* 'safari' then 'Safari' else 'Other' end;
$$;

create or replace function public.public_card_visit(p_token text, p_source text default 'nfc', p_referrer text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c nfc_cards; b businesses; br branches; dest text; ua text; recent int;
begin
  if p_token is null or p_token !~ '^[2-9A-Z]{6,16}$' then return jsonb_build_object('state', 'not_found'); end if;
  select * into c from nfc_cards where public_token = p_token;
  if not found then return jsonb_build_object('state', 'not_found'); end if;
  if c.status in ('lost', 'replaced') then return jsonb_build_object('state', 'disabled'); end if;
  if c.status <> 'active' or c.business_id is null then return jsonb_build_object('state', 'inactive'); end if;

  select * into b from businesses where id = c.business_id;
  if b.status = 'suspended' then return jsonb_build_object('state', 'inactive'); end if;
  select * into br from branches where id = c.branch_id;
  select url into dest from review_destinations where id = c.review_destination_id;
  if dest is null then select url into dest from review_destinations where business_id = c.business_id and is_default; end if;

  ua := left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300);

  -- Basic abuse protection: cap logged events per card per minute.
  select count(*) into recent from interaction_events where card_id = c.id and created_at > now() - interval '1 minute';
  if recent < 60 then
    insert into interaction_events (card_id, branch_id, business_id, event_type, user_agent, device_type, browser, referrer)
    values (c.id, c.branch_id, c.business_id, case when p_source = 'qr' then 'QR_SCAN'::event_type else 'NFC_TAP'::event_type end,
            ua, parse_device(ua), parse_browser(ua), left(p_referrer, 300)),
           (c.id, c.branch_id, c.business_id, 'LANDING_PAGE_VIEW', ua, parse_device(ua), parse_browser(ua), left(p_referrer, 300));
  end if;

  return jsonb_build_object(
    'state', 'ok',
    'business', jsonb_build_object('name', b.name, 'description', b.description, 'logo_url', b.logo_url, 'cover_url', b.cover_url,
                                   'phone', b.phone, 'email', b.email, 'website', b.website, 'facebook_url', b.facebook_url, 'category', b.category),
    'branch', case when br.id is null then null else jsonb_build_object('name', br.name, 'address', br.address, 'city', br.city, 'province', br.province) end,
    'review_url', dest
  );
end $$;

create or replace function public.public_review_click(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare c nfc_cards; dest text; ua text; recent int;
begin
  select * into c from nfc_cards where public_token = p_token and status = 'active';
  if not found then return null; end if;
  select url into dest from review_destinations where id = c.review_destination_id;
  if dest is null then select url into dest from review_destinations where business_id = c.business_id and is_default; end if;
  if dest is null then return null; end if;
  ua := left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 300);
  select count(*) into recent from interaction_events where card_id = c.id and created_at > now() - interval '1 minute';
  if recent < 60 then
    insert into interaction_events (card_id, branch_id, business_id, event_type, user_agent, device_type, browser)
    values (c.id, c.branch_id, c.business_id, 'GOOGLE_REVIEW_CLICK', ua, parse_device(ua), parse_browser(ua));
  end if;
  return dest;
end $$;

revoke all on function public.public_card_visit(text, text, text) from public;
revoke all on function public.public_review_click(text) from public;
grant execute on function public.public_card_visit(text, text, text) to anon, authenticated;
grant execute on function public.public_review_click(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: business self-registration
-- ---------------------------------------------------------------------------
create or replace function public.register_business(
  p_name text, p_category text, p_phone text, p_review_url text,
  p_branch_name text, p_address text, p_barangay text, p_city text, p_province text, p_region text, p_lat double precision, p_lng double precision
) returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid; base_slug text; admin boolean := public.is_admin();
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if char_length(coalesce(p_name, '')) < 2 then raise exception 'Business name is required'; end if;
  if not admin and (select count(*) from business_users where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'Business limit reached for this account';
  end if;
  base_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  -- Admins create businesses on behalf of owners (added later via add_business_member); self-registrations await approval.
  insert into businesses (name, slug, category, phone, email, owner_id, status)
  values (p_name, base_slug || '-' || lower(random_token(4)), p_category, p_phone,
          case when admin then null else (select email from profiles where id = auth.uid()) end,
          case when admin then null else auth.uid() end,
          case when admin then 'active' else 'pending' end)
  returning id into bid;
  if not admin then
    insert into business_users (business_id, user_id, role) values (bid, auth.uid(), 'owner');
  end if;
  if coalesce(p_review_url, '') <> '' then
    insert into review_destinations (business_id, url, is_default) values (bid, p_review_url, true);
  end if;
  if coalesce(p_branch_name, '') <> '' then
    insert into branches (business_id, name, address, barangay, city, province, region_code, lat, lng)
    values (bid, p_branch_name, p_address, p_barangay, p_city, p_province, p_region, p_lat, p_lng);
  end if;
  insert into subscriptions (business_id, plan) values (bid, 'free');
  return bid;
end $$;
grant execute on function public.register_business(text, text, text, text, text, text, text, text, text, text, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: replace a card (keeps history, links old -> new)
-- ---------------------------------------------------------------------------
create or replace function public.replace_card(p_card uuid, p_nfc_uid text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare old nfc_cards; new_id uuid;
begin
  select * into old from nfc_cards where id = p_card for update;
  if not found then raise exception 'Card not found'; end if;
  if not (public.is_admin() or (old.business_id is not null and public.is_owner(old.business_id))) then
    raise exception 'Not allowed';
  end if;
  if old.status = 'replaced' then raise exception 'Card was already replaced'; end if;

  insert into nfc_cards (nfc_uid, card_name, card_type, status, business_id, branch_id, review_destination_id,
                         manufacturer, tag_type, material, purchase_batch, purchase_date, notes, replaces)
  values (nullif(p_nfc_uid, ''), old.card_name, old.card_type, case when old.business_id is null then 'inactive' else 'active' end::card_status,
          old.business_id, old.branch_id, old.review_destination_id, old.manufacturer, old.tag_type, old.material,
          old.purchase_batch, old.purchase_date, old.notes, old.id)
  returning id into new_id;

  perform set_config('tapreview.replacing', 'on', true);
  update nfc_cards set status = 'replaced', replaced_by = new_id, deactivated_at = now() where id = old.id;
  perform set_config('tapreview.replacing', 'off', true);

  perform write_audit('card.replaced', 'card', old.id, old.id, old.business_id,
    jsonb_build_object('new_card', (select card_code from nfc_cards where id = new_id), 'reason', p_reason));
  if old.business_id is not null then
    perform notify_business(old.business_id, 'card.replaced', 'Card replaced', old.card_code || ' was replaced', '/app/cards/' || new_id);
  end if;
  return new_id;
end $$;
grant execute on function public.replace_card(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: add a staff member / co-owner by email
-- ---------------------------------------------------------------------------
create or replace function public.add_business_member(p_business uuid, p_email text, p_role member_role, p_branch_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not (public.is_admin() or public.is_owner(p_business)) then raise exception 'Not allowed'; end if;
  select id into uid from profiles where lower(email) = lower(p_email);
  if uid is null then raise exception 'No account with that email. Ask them to sign up first.'; end if;
  insert into business_users (business_id, user_id, role, branch_ids) values (p_business, uid, p_role, p_branch_ids)
  on conflict (business_id, user_id) do update set role = excluded.role, branch_ids = excluded.branch_ids;
  if p_role = 'owner' then
    update businesses set owner_id = uid where id = p_business and owner_id is null;
  end if;
  perform write_audit('member.added', 'business', p_business, null, p_business, jsonb_build_object('email', p_email, 'role', p_role));
end $$;
grant execute on function public.add_business_member(uuid, text, member_role, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: activity by day (RLS applies via security invoker)
-- ---------------------------------------------------------------------------
create or replace function public.activity_by_day(p_from date, p_business uuid default null, p_branch uuid default null, p_card uuid default null)
returns table (day date, nfc bigint, qr bigint, views bigint, clicks bigint)
language sql stable security invoker set search_path = public as $$
  select s.day, sum(s.nfc), sum(s.qr), sum(s.views), sum(s.clicks)
  from card_daily_stats s
  where s.day >= p_from
    and (p_business is null or s.business_id = p_business)
    and (p_branch is null or s.branch_id = p_branch)
    and (p_card is null or s.card_id = p_card)
  group by s.day order by s.day;
$$;
grant execute on function public.activity_by_day(date, uuid, uuid, uuid) to authenticated;

-- Totals per card within a date window (for "top cards" over a period)
create or replace function public.card_totals_since(p_from date)
returns table (card_id uuid, taps bigint, scans bigint, views bigint, clicks bigint)
language sql stable security invoker set search_path = public as $$
  select card_id, sum(nfc), sum(qr), sum(views), sum(clicks) from card_daily_stats where day >= p_from group by card_id;
$$;
grant execute on function public.card_totals_since(date) to authenticated;

-- Make an existing account an administrator (run manually in the SQL editor):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
