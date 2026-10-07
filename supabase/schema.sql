-- GenZ Men's - Supabase database foundation
-- Run this in Supabase SQL Editor after creating the project.
-- No service-role keys or secrets belong in this file.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  sizes text[] not null default array['S','M','L','XL','XXL']::text[],
  badge text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 1,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  updated_at timestamptz not null default now(),
  unique(product_id, size)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address_line text not null,
  area_locality text not null,
  pincode text not null,
  city text not null,
  state text not null,
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  delivery_charge numeric(10,2) not null default 0 check (delivery_charge >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  order_status text not null default 'Pending'
    check (order_status in ('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled')),
  payment_method text
    check (payment_method is null or payment_method in ('UPI','Card','Net Banking','COD')),
  payment_status text not null default 'Pending'
    check (payment_status in ('Pending','Paid','Failed','Refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  size text not null,
  quantity integer not null check (quantity > 0 and quantity <= 9),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0)
);

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Public storefront: only active product/catalog data is readable.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select
using (is_active = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (is_active = true);

drop policy if exists "Public can read images for active products" on public.product_images;
create policy "Public can read images for active products"
on public.product_images for select
using (
  exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.is_active = true
  )
);

drop policy if exists "Public can read inventory for active products" on public.inventory;
create policy "Public can read inventory for active products"
on public.inventory for select
using (
  exists (
    select 1 from public.products p
    where p.id = inventory.product_id and p.is_active = true
  )
);

-- Orders/customers will be written through the application flow later.
-- Do not expose unrestricted public insert/update policies here.
-- Admin access will be implemented with Supabase Auth + an admin allow-list.

-- Seed the current demo categories.
insert into public.categories (name, slug)
values
  ('Shirts','shirts'),
  ('T-Shirts','t-shirts'),
  ('Kurtas','kurtas'),
  ('Bottomwear','bottomwear')
on conflict (slug) do nothing;


-- Admin allow-list for Supabase Auth users.
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "Admins can read own allow-list entry" on public.admin_users;
create policy "Admins can read own allow-list entry" on public.admin_users for select to authenticated
using (lower(email)=lower(coalesce(auth.jwt()->>'email','')));

-- Admin CRUD policies.
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products" on public.products for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage product images" on public.product_images;
create policy "Admins can manage product images" on public.product_images for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage inventory" on public.inventory;
create policy "Admins can manage inventory" on public.inventory for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage customers" on public.customers;
create policy "Admins can manage customers" on public.customers for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders" on public.orders for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));
drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items" on public.order_items for all to authenticated
using (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))))
with check (exists(select 1 from public.admin_users a where lower(a.email)=lower(coalesce(auth.jwt()->>'email',''))));

-- After creating the first admin user in Supabase Auth, add their exact email:
-- insert into public.admin_users(email) values ('YOUR_ADMIN_EMAIL');
