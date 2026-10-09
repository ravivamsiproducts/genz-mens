-- GenZ Men's payment go-live hardening
-- Run once in Supabase SQL Editor after razorpay-payment.sql.
-- This locks down legacy public checkout RPCs and makes captured-payment
-- processing idempotent at the database level.

-- A captured Razorpay payment must not create multiple store orders.
create unique index if not exists orders_gateway_payment_id_unique_idx
  on public.orders(gateway_payment_id)
  where gateway_payment_id is not null;

-- The same Razorpay order ID should not be attached to two store orders.
create unique index if not exists orders_gateway_order_id_unique_idx
  on public.orders(gateway_order_id)
  where gateway_order_id is not null;

-- Legacy RPCs were created for the pre-gateway prototype and accept public checkout
-- submissions without Razorpay signature verification. The website now uses
-- create-payment-order + verify-and-create-order + create_store_order_v3 instead.
revoke all on function public.create_store_order(
  text,text,text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;

revoke all on function public.create_store_order_v2(
  text,text,text,text,text,text,text,text,text,numeric,jsonb
) from public, anon, authenticated;

-- Explicitly keep the final order creation RPC server-only.
revoke all on function public.create_store_order_v3(
  text,text,text,text,text,text,text,text,text,numeric,text,text,text,jsonb
) from public, anon, authenticated;

grant execute on function public.create_store_order_v3(
  text,text,text,text,text,text,text,text,text,numeric,text,text,text,jsonb
) to service_role;
