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
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured.");
  return { keyId, keySecret };
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizeItems(items: any[]) {
  return items.map((item: any) => ({
    product_id: String(item.product_id || ""),
    size: String(item.size || "").trim(),
    quantity: Math.max(1, Math.min(9, Number(item.quantity || 1)))
  })).sort((a: any, b: any) =>
    a.product_id.localeCompare(b.product_id) ||
    a.size.localeCompare(b.size) ||
    a.quantity - b.quantity
  );
}

async function hashCart(items: any[]) {
  const canonical = JSON.stringify(normalizeItems(items));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cartAmount(products: any[], items: any[], mode: string, requestedAdvance: number) {
  const priceMap = Object.fromEntries(products.map(p => [p.id, Number(p.price || 0)]));
  let subtotal = 0;
  for (const item of items) {
    const id = String(item.product_id || "");
    const qty = Math.max(1, Math.min(9, Number(item.quantity || 1)));
    if (!priceMap[id]) throw new Error("Product is unavailable.");
    subtotal += priceMap[id] * qty;
  }
  if (subtotal <= 0) throw new Error("Cart total must be greater than zero.");
  if (mode === "UPI") return { subtotal, payNow: subtotal, due: 0, orderValue: subtotal };
  if (mode === "COD") return { subtotal, payNow: 100, due: subtotal, orderValue: subtotal + 100 };
  const advance = Math.max(100, Math.floor(Number(requestedAdvance || 100)));
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
    const razorpayOrderId = String(body.razorpay_order_id || "");
    const razorpayPaymentId = String(body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpay_signature || "");
    const checkout = body.checkout || {};

    if (!["UPI", "COD", "UPI Advance + COD"].includes(mode)) return json({ error: "Invalid payment method." }, 400);
    if (!items.length) return json({ error: "Cart is empty." }, 400);
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return json({ error: "Payment verification data is incomplete." }, 400);

    const serviceKey = getServiceKey();
    if (!serviceKey) return json({ error: "Supabase server key is not configured." }, 500);
    const { keyId, keySecret } = getRazorpayCredentials();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const expected = await hmacSha256Hex(keySecret, razorpayOrderId + "|" + razorpayPaymentId);
    if (expected !== razorpaySignature) return json({ error: "Invalid Razorpay payment signature." }, 400);

    const normalizedItems = normalizeItems(items);
    const cartHash = await hashCart(items);
    const razorpayAuth = "Basic " + btoa(`${keyId}:${keySecret}`);

    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}`, {
      headers: { "Authorization": razorpayAuth }
    });
    const razorpayOrder = await orderRes.json();
    if (!orderRes.ok) throw new Error(razorpayOrder?.error?.description || "Could not fetch Razorpay order.");
    if (razorpayOrder.currency !== "INR") throw new Error("Unexpected order currency.");
    if (Number(razorpayOrder.amount || 0) <= 0) throw new Error("Invalid Razorpay order amount.");
    if (razorpayOrder.notes?.payment_mode !== mode || razorpayOrder.notes?.cart_hash !== cartHash) {
      throw new Error("Payment order does not match the selected payment method or cart. Please restart checkout.");
    }

    const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`, {
      headers: { "Authorization": razorpayAuth }
    });
    const payment = await paymentRes.json();
    if (!paymentRes.ok) throw new Error(payment?.error?.description || "Could not fetch Razorpay payment.");
    if (payment.order_id !== razorpayOrderId) throw new Error("Payment order mismatch.");
    if (payment.currency !== "INR") throw new Error("Unexpected payment currency.");

    const ids = [...new Set(items.map((i: any) => String(i.product_id || "")).filter(Boolean))];
    const { data: products, error: pe } = await supabase
      .from("products")
      .select("id,name,price,is_active")
      .in("id", ids)
      .eq("is_active", true);
    if (pe) throw pe;

    const breakdown = cartAmount(products || [], items, mode, partialAdvance);
    if (Number(payment.amount || 0) !== Math.round(breakdown.payNow * 100) ||
        Number(razorpayOrder.amount || 0) !== Math.round(breakdown.payNow * 100)) {
      throw new Error("Payment amount does not match the order.");
    }

    if (payment.status !== "captured") {
      throw new Error("Payment is not captured yet. Please wait and try again.");
    }

    const { data: existing } = await supabase
      .from("orders")
      .select("id,order_number,total,upfront_amount,amount_due,payment_status")
      .eq("gateway_payment_id", razorpayPaymentId)
      .maybeSingle();

    if (existing) return json(existing);

    const { data: orderData, error: orderError } = await supabase.rpc("create_store_order_v3", {
      p_customer_name: String(checkout.customer_name || "").trim(),
      p_customer_phone: String(checkout.customer_phone || "").trim(),
      p_customer_email: String(checkout.customer_email || "").trim(),
      p_address_line: String(checkout.address_line || "").trim(),
      p_area_locality: String(checkout.area_locality || "").trim(),
      p_pincode: String(checkout.pincode || "").trim(),
      p_city: String(checkout.city || "").trim(),
      p_state: String(checkout.state || "").trim(),
      p_payment_method: mode,
      p_upfront_amount: breakdown.payNow,
      p_gateway_order_id: razorpayOrderId,
      p_gateway_payment_id: razorpayPaymentId,
      p_payment_gateway: "razorpay",
      p_items: items
    });

    if (orderError) {
      // The customer has already paid. Attempt a full refund if stock/order creation fails.
      await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}/refund`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${keyId}:${keySecret}`),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }).catch(() => null);
      throw orderError;
    }

    return json(orderData);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Payment verification failed." }, 400);
  }
});
