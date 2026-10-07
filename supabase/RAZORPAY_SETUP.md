# GenZ Men's — Razorpay payment setup

The repository now contains the secure server-side payment layer:

- `supabase/razorpay-payment.sql`
- `supabase/functions/create-payment-order/index.ts`
- `supabase/functions/verify-and-create-order/index.ts`
- `supabase/config.toml`

## Supabase

Run `supabase/razorpay-payment.sql` once in SQL Editor.

## Razorpay

Create/activate your Razorpay merchant account and generate API keys.

Store these as **Supabase Edge Function production secrets** (never in GitHub or browser JavaScript):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Supabase Dashboard: Project → Edge Functions → Secrets.

## Deploy functions

Deploy:

- `create-payment-order`
- `verify-and-create-order`

They are configured for anonymous storefront checkout because customers do not need a Supabase login. The functions themselves validate the payment server-side.

## Payment flow

1. Storefront calculates the intended mode and items.
2. Edge Function calculates the amount from live Supabase product prices.
3. Edge Function creates a Razorpay order.
4. Razorpay Checkout collects the UPI payment.
5. The verification Edge Function validates the Razorpay signature and captured amount.
6. Only after successful verification does the database create the final order and reduce inventory.
7. COD stores the ₹100 upfront amount separately from the product amount due on delivery.
8. Partial Payment stores the UPI upfront amount and remaining delivery balance separately.

Do not put `RAZORPAY_KEY_SECRET`, Supabase secret keys, API passwords, or UPI PINs in `script.js`.
