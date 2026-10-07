-- GenZ Men's: Supabase Storage setup for Admin Product Images
-- Run this once in Supabase Dashboard -> SQL Editor.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Admin product images upload" on storage.objects;
drop policy if exists "Admin product images update" on storage.objects;
drop policy if exists "Admin product images delete" on storage.objects;

create policy "Admin product images upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.email())
  )
);

create policy "Admin product images update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.email())
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.email())
  )
);

create policy "Admin product images delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.admin_users
    where lower(email) = lower(auth.email())
  )
);
