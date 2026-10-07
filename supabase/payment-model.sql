-- GenZ Men's payment model migration
-- Run once in Supabase SQL Editor.

alter table public.orders
  add column if not exists upfront_amount numeric(10,2) not null default 0 check (upfront_amount >= 0),
  add column if not exists amount_due numeric(10,2) not null default 0 check (amount_due >= 0);

-- Preserve existing order totals; old orders are treated as already having no recorded upfront payment.
update public.orders
set upfront_amount=coalesce(upfront_amount,0),
    amount_due=greatest(0,coalesce(total,0))
where upfront_amount is null or amount_due is null;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('UPI','Card','Net Banking','COD','UPI Advance + COD'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('Pending','Partially Paid','Paid','Failed','Refunded'));

create or replace function public.create_store_order_v2(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address_line text,
  p_area_locality text,
  p_pincode text,
  p_city text,
  p_state text,
  p_payment_method text,
  p_upfront_amount numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_delivery_charge numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_upfront numeric(10,2) := 0;
  v_amount_due numeric(10,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_product_name text;
  v_size text;
  v_qty integer;
  v_unit_price numeric(10,2);
  v_stock integer;
  v_line_total numeric(10,2);
begin
  if trim(coalesce(p_customer_name,'')) = '' then raise exception 'Customer name is required'; end if;
  if p_customer_phone !~ '^[0-9]{10}$' then raise exception 'Valid 10-digit phone number is required'; end if;
  if p_pincode !~ '^[0-9]{6}$' then raise exception 'Valid 6-digit PIN code is required'; end if;
  if p_payment_method not in ('UPI','COD','UPI Advance + COD') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  select id into v_customer_id
  from public.customers
  where phone = p_customer_phone
  order by created_at desc
  limit 1;

  if v_customer_id is null then
    insert into public.customers(full_name,phone,email)
    values (trim(p_customer_name),p_customer_phone,nullif(trim(p_customer_email),''))
    returning id into v_customer_id;
  else
    update public.customers
    set full_name=trim(p_customer_name),
        email=nullif(trim(p_customer_email),'')
    where id=v_customer_id;
  end if;

  v_order_number := 'GZM-' || to_char(now(),'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(
    order_number,customer_id,customer_name,customer_phone,customer_email,
    address_line,area_locality,pincode,city,state,
    subtotal,delivery_charge,total,order_status,payment_method,payment_status,
    upfront_amount,amount_due
  )
  values (
    v_order_number,v_customer_id,trim(p_customer_name),p_customer_phone,
    nullif(trim(p_customer_email),''),
    trim(p_address_line),trim(p_area_locality),p_pincode,trim(p_city),trim(p_state),
    0,0,0,'Pending',p_payment_method,'Pending',0,0
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid product ID';
    end;

    v_size := trim(v_item->>'size');
    v_qty := greatest(1, least(9, coalesce((v_item->>'quantity')::integer,1)));

    select p.name, p.price
      into v_product_name, v_unit_price
    from public.products p
    where p.id=v_product_id and p.is_active=true;

    if v_product_name is null then
      raise exception 'Product is unavailable';
    end if;

    select stock_qty into v_stock
    from public.inventory
    where product_id=v_product_id and size=v_size
    for update;

    if v_stock is null then
      raise exception 'Selected size is unavailable for %', v_product_name;
    end if;

    if v_stock < v_qty then
      raise exception 'Only % item(s) available for % - size %', v_stock, v_product_name, v_size;
    end if;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    insert into public.order_items(
      order_id,product_id,product_name,size,quantity,unit_price,line_total
    )
    values (
      v_order_id,v_product_id,v_product_name,v_size,v_qty,v_unit_price,v_line_total
    );

    update public.inventory
    set stock_qty=stock_qty-v_qty
    where product_id=v_product_id and size=v_size;
  end loop;

  if p_payment_method='COD' then
    v_delivery_charge := 100;
    v_upfront := 100;
    v_total := v_subtotal + 100;
    v_amount_due := v_subtotal;
  elsif p_payment_method='UPI' then
    v_delivery_charge := 0;
    v_upfront := v_subtotal;
    v_total := v_subtotal;
    v_amount_due := 0;
  else
    v_delivery_charge := 0;
    v_upfront := round(coalesce(p_upfront_amount,0),2);
    if v_upfront < 100 then
      raise exception 'Partial UPI advance must be at least ₹100';
    end if;
    if v_upfront >= v_subtotal then
      raise exception 'Partial UPI advance must be less than the order value';
    end if;
    v_total := v_subtotal;
    v_amount_due := v_subtotal - v_upfront;
  end if;

  update public.orders
  set subtotal=v_subtotal,
      delivery_charge=v_delivery_charge,
      total=v_total,
      upfront_amount=v_upfront,
      amount_due=v_amount_due,
      payment_status='Pending'
  where id=v_order_id;

  return jsonb_build_object(
    'order_id',v_order_id,
    'order_number',v_order_number,
    'subtotal',v_subtotal,
    'delivery_charge',v_delivery_charge,
    'total',v_total,
    'upfront_amount',v_upfront,
    'amount_due',v_amount_due
  );
end;
$$;

revoke all on function public.create_store_order_v2(text,text,text,text,text,text,text,text,text,numeric,jsonb) from public;
grant execute on function public.create_store_order_v2(text,text,text,text,text,text,text,text,text,numeric,jsonb) to anon, authenticated;
