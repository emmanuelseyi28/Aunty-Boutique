-- Adds protected product management for approved store administrators.

-- This ID is independent of any product ID column the existing table may have.
alter table public.products
  add column if not exists admin_id uuid default gen_random_uuid();

update public.products
set admin_id = gen_random_uuid()
where admin_id is null;

alter table public.products
  alter column admin_id set default gen_random_uuid(),
  alter column admin_id set not null;

create unique index if not exists products_admin_id_unique
  on public.products (admin_id);

alter table public.products
  add column if not exists is_exclusive boolean not null default false;

alter table public.products enable row level security;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

drop policy if exists "Admins can view their own admin record" on public.admin_users;
create policy "Admins can view their own admin record"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

grant insert, update on public.products to authenticated;

drop policy if exists "Store admins can view all products" on public.products;
create policy "Store admins can view all products"
  on public.products for select
  to authenticated
  using (public.is_store_admin());

drop policy if exists "Store admins can add products" on public.products;
create policy "Store admins can add products"
  on public.products for insert
  to authenticated
  with check (public.is_store_admin());

drop policy if exists "Store admins can edit products" on public.products;
create policy "Store admins can edit products"
  on public.products for update
  to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

-- Product photos are public storefront images; only approved admins may upload them.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Store admins can upload product images" on storage.objects;
create policy "Store admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_store_admin());

drop policy if exists "Store admins can update product images" on storage.objects;
create policy "Store admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_store_admin())
  with check (bucket_id = 'product-images' and public.is_store_admin());
