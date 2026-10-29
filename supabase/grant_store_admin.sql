-- Replace the example address with the email used to create the administrator's
-- regular Phunvict Fashion account, then run this in the Supabase SQL Editor.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
