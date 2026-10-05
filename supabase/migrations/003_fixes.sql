-- Fixes applied after the initial schema:
-- 1. random_token: include the "extensions" schema (where Supabase installs pgcrypto) in search_path.
-- 2. register_business: admins create businesses without becoming the owner; validates name.
-- 3. add_business_member: adding an owner sets businesses.owner_id when empty.

create or replace function public.random_token(len int default 10) returns text
language plpgsql volatile set search_path = public, extensions as $$
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
