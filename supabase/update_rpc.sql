-- ==============================================================================
-- Run this script in your Supabase SQL Editor to update your database schema
-- and support custom dates and payment editing.
-- ==============================================================================

-- 1. Drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.record_sale(uuid, payment_method, numeric, numeric, numeric, jsonb);
DROP FUNCTION IF EXISTS public.record_payment(uuid, numeric, text, text);

-- 2. Create the updated record_sale function
CREATE OR REPLACE FUNCTION public.record_sale(
  p_customer_id uuid,
  p_payment_method payment_method,
  p_amount_tendered numeric,
  p_card_amount numeric default 0,
  p_tax_rate numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_created_at timestamptz default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn_id uuid;
  v_receipt text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_tax numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_unit_price numeric;
  v_item_discount numeric;
  v_line_total numeric;
  v_stock integer;
  v_change numeric;
  v_cust_balance numeric := 0;
  v_effective_date timestamptz := coalesce(p_created_at, now());
BEGIN
  -- Validate credit conditions
  if p_payment_method = 'credit' and p_customer_id is null then
    raise exception 'CUSTOMER_REQUIRED_FOR_CREDIT';
  end if;

  -- Create the transaction shell first
  v_receipt := to_char(v_effective_date, 'YYMMDD') || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
  
  insert into public.transactions (receipt_number, cashier_id, customer_id, payment_method, amount_tendered, card_amount, tax_rate, created_at)
  values (v_receipt, auth.uid(), p_customer_id, p_payment_method, p_amount_tendered, coalesce(p_card_amount, 0), coalesce(p_tax_rate, 0), v_effective_date)
  returning id into v_txn_id;

  -- Validate stock and insert line items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_item_discount := coalesce((v_item->>'discount')::numeric, 0);
    v_line_total := round((v_unit_price * v_qty) - v_item_discount, 2);

    if v_qty > 0 then
      select quantity_on_hand into v_stock from public.products where id = v_product_id;
      if v_stock < v_qty then
        raise exception 'INSUFFICIENT_STOCK:%:%', v_product_id, v_stock;
      end if;
      update public.products set quantity_on_hand = quantity_on_hand - v_qty, updated_at = now()
        where id = v_product_id;
      insert into public.transaction_items
        (transaction_id, product_id, product_name, sku, quantity, unit_price, discount, line_total)
      select v_txn_id, id, name, sku, v_qty, v_unit_price, v_item_discount, v_line_total
        from public.products where id = v_product_id;
    else
      -- Negative quantity = refund/return of stock
      update public.products set quantity_on_hand = quantity_on_hand - v_qty, updated_at = now()
        where id = v_product_id;
      insert into public.transaction_items
        (transaction_id, product_id, product_name, sku, quantity, unit_price, discount, line_total)
      select v_txn_id, id, name, sku, v_qty, v_unit_price, v_item_discount, v_line_total
        from public.products where id = v_product_id;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_discount := v_discount + v_item_discount;
  end loop;

  v_tax := round(v_subtotal * coalesce(p_tax_rate, 0), 2);
  v_total := round(v_subtotal - v_discount + v_tax, 2);
  v_change := greatest(0, p_amount_tendered - v_total);

  update public.transactions
     set subtotal = v_subtotal,
         discount = v_discount,
         tax = v_tax,
         total = v_total,
         change_due = v_change
   where id = v_txn_id;

  -- Handle ledger and customer balance updates
  if p_customer_id is not null then
    if p_payment_method = 'credit' then
      update public.customers set balance = balance + v_total where id = p_customer_id;
      select balance into v_cust_balance from public.customers where id = p_customer_id;
      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance, created_at)
      values (p_customer_id, 'sale', v_txn_id, 'Credit Sale - Receipt #' || v_receipt, v_total, 0, v_cust_balance, v_effective_date);
    else
      select balance into v_cust_balance from public.customers where id = p_customer_id;
      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance, created_at)
      values (p_customer_id, 'sale', v_txn_id, 'Sale - Receipt #' || v_receipt, v_total, v_total, v_cust_balance, v_effective_date);
    end if;
    
    -- Force recalculation of running balances if a past date was provided
    if p_created_at is not null then
      update public.customer_ledger cl
      set balance = sub.run_bal
      from (
        select id, sum(debit - credit) over (partition by customer_id order by created_at, id) as run_bal
        from public.customer_ledger
        where customer_id = p_customer_id
      ) sub
      where cl.id = sub.id and cl.customer_id = p_customer_id;
      
      -- Update customer's final balance to match the final ledger balance
      update public.customers c
      set balance = coalesce((
        select balance from public.customer_ledger 
        where customer_id = p_customer_id 
        order by created_at desc, id desc limit 1
      ), 0)
      where id = p_customer_id;
    end if;
  end if;

  return jsonb_build_object('id', v_txn_id, 'receipt_number', v_receipt, 'total', v_total);
END;
$$;


-- 3. Create the updated record_payment function
CREATE OR REPLACE FUNCTION public.record_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text default '',
  p_created_at timestamptz default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
  v_ref_id uuid;
  v_effective_date timestamptz := coalesce(p_created_at, now());
BEGIN
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.customers
     set balance = balance - p_amount,
         updated_at = now()
   where id = p_customer_id
   returning balance into v_new_balance;

  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance, created_at)
  values (
    p_customer_id,
    'payment',
    null,
    coalesce(nullif(p_note, ''), 'Payment received via ' || initcap(p_payment_method)),
    0,
    p_amount,
    v_new_balance,
    v_effective_date
  ) returning id into v_ref_id;

  -- Force recalculation of running balances if a past date was provided
  if p_created_at is not null then
    update public.customer_ledger cl
    set balance = sub.run_bal
    from (
      select id, sum(debit - credit) over (partition by customer_id order by created_at, id) as run_bal
      from public.customer_ledger
      where customer_id = p_customer_id
    ) sub
    where cl.id = sub.id and cl.customer_id = p_customer_id;
    
    update public.customers c
    set balance = coalesce((
      select balance from public.customer_ledger 
      where customer_id = p_customer_id 
      order by created_at desc, id desc limit 1
    ), 0)
    where id = p_customer_id
    returning balance into v_new_balance;
  end if;

  return jsonb_build_object('success', true, 'new_balance', v_new_balance, 'ledger_id', v_ref_id);
END;
$$;


-- 4. Create edit_payment function
CREATE OR REPLACE FUNCTION public.edit_payment(
  p_ledger_id uuid,
  p_amount numeric default null,
  p_note text default null,
  p_created_at timestamptz default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Verify the ledger entry exists and is a payment
  select customer_id into v_customer_id
  from public.customer_ledger
  where id = p_ledger_id and type = 'payment';

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- Update the fields
  update public.customer_ledger
  set credit = coalesce(p_amount, credit),
      description = coalesce(p_note, description),
      created_at = coalesce(p_created_at, created_at)
  where id = p_ledger_id;

  -- Recalculate running balances for this customer
  update public.customer_ledger cl
  set balance = sub.run_bal
  from (
    select id, sum(debit - credit) over (partition by customer_id order by created_at, id) as run_bal
    from public.customer_ledger
    where customer_id = v_customer_id
  ) sub
  where cl.id = sub.id and cl.customer_id = v_customer_id;

  -- Update customer total balance
  update public.customers
  set balance = coalesce((
    select balance from public.customer_ledger 
    where customer_id = v_customer_id 
    order by created_at desc, id desc limit 1
  ), 0),
  updated_at = now()
  where id = v_customer_id;
END;
$$;


-- 5. Create delete_payment function
CREATE OR REPLACE FUNCTION public.delete_payment(
  p_ledger_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Verify the ledger entry exists and is a payment
  select customer_id into v_customer_id
  from public.customer_ledger
  where id = p_ledger_id and type = 'payment';

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  -- Delete the payment
  delete from public.customer_ledger where id = p_ledger_id;

  -- Recalculate running balances for this customer
  update public.customer_ledger cl
  set balance = sub.run_bal
  from (
    select id, sum(debit - credit) over (partition by customer_id order by created_at, id) as run_bal
    from public.customer_ledger
    where customer_id = v_customer_id
  ) sub
  where cl.id = sub.id and cl.customer_id = v_customer_id;

  -- Update customer total balance
  update public.customers
  set balance = coalesce((
    select balance from public.customer_ledger 
    where customer_id = v_customer_id 
    order by created_at desc, id desc limit 1
  ), 0),
  updated_at = now()
  where id = v_customer_id;
END;
$$;
