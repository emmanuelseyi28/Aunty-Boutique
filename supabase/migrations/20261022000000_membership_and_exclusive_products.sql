-- Run this migration in the Supabase SQL Editor for the existing boutique project.

-- Keep customer profile details separate from Supabase Auth credentials.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  home_address text not null default '',
  username text not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;

drop policy if exists "Members can view their own profile" on public.profiles;
create policy "Members can view their own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Members can update their own profile" on public.profiles;
create policy "Members can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Give any existing Auth users a profile too, without replacing existing details.
insert into public.profiles (id, full_name, phone, home_address, username)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'full_name', ''),
  coalesce(users.raw_user_meta_data ->> 'phone', ''),
  coalesce(users.raw_user_meta_data ->> 'home_address', ''),
  coalesce(nullif(users.raw_user_meta_data ->> 'username', ''), 'member_' || left(replace(users.id::text, '-', ''), 12))
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

-- Private profile image storage. Each member can manage files in their own folder only.
insert into storage.buckets (id, name, public)
values ('member-avatars', 'member-avatars', false)
on conflict (id) do update set public = false;

drop policy if exists "Members can view their own avatar files" on storage.objects;
create policy "Members can view their own avatar files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members can upload their own avatar files" on storage.objects;
create policy "Members can upload their own avatar files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members can update their own avatar files" on storage.objects;
create policy "Members can update their own avatar files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members can delete their own avatar files" on storage.objects;
create policy "Members can delete their own avatar files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'member-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.create_member_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone, home_address, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'home_address', ''),
    coalesce(new.raw_user_meta_data ->> 'username', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute function public.create_member_profile();

-- Add a flag to existing products. All existing rows remain regular products.
alter table public.products
  add column if not exists is_exclusive boolean not null default false;

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;

-- Remove the earlier policy that allowed visitors to read every product.
drop policy if exists "Products are viewable by everyone" on public.products;
drop policy if exists "Public can view active regular products" on public.products;
drop policy if exists "Members can view active products" on public.products;

create policy "Public can view active regular products"
  on public.products for select
  to anon
  using (is_active = true and is_exclusive = false);

create policy "Members can view active products"
  on public.products for select
  to authenticated
  using (is_active = true);
