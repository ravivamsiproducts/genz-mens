import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getServiceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Object.values(keys)[0];
  } catch {
    return null;
  }
}

function getRazorpayCredentials() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured in Supabase Edge Function secrets.");
  return { keyId, keySecret };
}

function cartAmount(products: any[], inventoryRows: any[], items: any[], mode: string, requestedAdvance: number) {
  const priceMap = Object.fromEntries(products.map(p => [p.id, Number(p.price || 0)]));
  const stockMap: Record<string, number> = {};
  for (const row of inventoryRows) stockMap[`${row.product_id}::${row.size}`] = Number(row.stock_qty || 0);

  let subtotal = 0;
  for (const item of items) {
    const id = String(item.product_id || "");
    const size = String(item.size || "").trim();
    const qty = Math.max(1, Math.min(9, Number(item.quantity || 1)));
    if (!priceMap[id]) throw new Error("Product is unavailable.");
    const stock = stockMap[`${id}::${size}`];
    if (stock === undefined) throw new Error("Selected size is unavailable.");
    if (stock < qty) throw new Error("Selected quantity is no longer available.");
    subtotal += priceMap[id] * qty;
  }

  if (subtotal <= 0) throw new Error("Cart total must be greater than zero.");

  if (mode === "UPI") return { subtotal, payNow: subtotal, due: 0, orderValue: subtotal };
  if (mode === "COD") return { subtotal, payNow: 100, due: subtotal, orderValue: subtotal + 100 };

  let advance = Math.max(100, Math.floor(Number(requestedAdvance || 100)));
  if (advance >= subtotal) throw new Error("Partial UPI advance must be less than the order value.");
  return { subtotal, payNow: advance, due: subtotal - advance, orderValue: subtotal };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json();
    const mode = String(body.mode || "");
    const items = Array.isArray(body.items) ? body.items : [];
    const partialAdvance = Number(body.partial_advance || 100);

    if (!["UPI", "COD", "UPI Advance + COD"].includes(mode)) {
      return json({ error: "Invalid payment method." }, 400);
    }
    if (!items.length) return json({ error: "Cart is empty." }, 400);

    const serviceKey = getServiceKey();
    if (!serviceKey) return json({ error: "Supabase server key is not configured." }, 500);
    const { keyId, keySecret } = getRazorpayCredentials();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const ids = [...new Set(items.map((i: any) => String(i.product_id || "")).filter(Boolean))];
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,price,is_active")
      .in("id", ids)
      .eq("is_active", true);
    if (pe) throw pe;

    const { data: inventory, error: ie } = await supabase
      .from("inventory")
      .select("product_id,size,stock_qty")
      .in("product_id", ids);
    if (ie) throw ie;

    const breakdown = cartAmount(products || [], inventory || [], items, mode, partialAdvance);
    const razorpayOrder = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${keyId}:${keySecret}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Math.round(breakdown.payNow * 100),
        currency: "INR",
        receipt: "GZM-" + Date.now().toString(36).toUpperCase(),
        notes: {
          brand: "GenZ Men's",
          payment_mode: mode,
          order_value: breakdown.orderValue.toFixed(2),
          amount_due: breakdown.due.toFixed(2)
        }
      })
    });

    const rp = await razorpayOrder.json();
    if (!razorpayOrder.ok) {
      throw new Error(rp?.error?.description || "Razorpay order creation failed.");
    }

    return json({
      key_id: keyId,
      razorpay_order_id: rp.id,
      amount: breakdown.payNow,
      amount_paise: rp.amount,
      currency: "INR",
      mode,
      subtotal: breakdown.subtotal,
      upfront_amount: breakdown.payNow,
      amount_due: breakdown.due,
      total: breakdown.orderValue
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Payment order creation failed." }, 400);
  }
});
