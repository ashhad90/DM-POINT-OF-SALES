-- ==============================================================================
-- Run this script in your Supabase SQL Editor to update your database schema
-- and support full transaction editing (update_sale).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_sale(
  p_txn_id uuid,
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
  v_old_customer_id uuid;
  v_old_total numeric;
  v_old_payment_method payment_method;
  v_receipt text;
  v_old_created_at timestamptz;
  
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
  v_effective_date timestamptz;
BEGIN
  -- 1. Validate credit conditions
  if p_payment_method = 'credit' and p_customer_id is null then
    raise exception 'CUSTOMER_REQUIRED_FOR_CREDIT';
  end if;

  -- 2. Fetch existing transaction details
  if not exists (select 1 from public.transactions where id = p_txn_id and status = 'completed') then
    raise exception 'TRANSACTION_NOT_FOUND_OR_VOIDED';
  end if;

  select customer_id, total, payment_method, receipt_number, created_at
    into v_old_customer_id, v_old_total, v_old_payment_method, v_receipt, v_old_created_at
    from public.transactions
   where id = p_txn_id;
   
  v_effective_date := coalesce(p_created_at, v_old_created_at);

  -- 3. Restore old stock
  update public.products p
     set quantity_on_hand = quantity_on_hand + ti.quantity,
         updated_at = now()
    from public.transaction_items ti
   where ti.product_id = p.id and ti.transaction_id = p_txn_id;

  -- 4. Delete old transaction items
  delete from public.transaction_items where transaction_id = p_txn_id;

  -- 5. Reverse old ledger entries if there was an old customer
  if v_old_customer_id is not null then
    -- Remove the old ledger entry for this sale
    delete from public.customer_ledger 
    where reference_id = p_txn_id and type = 'sale';
    
    if v_old_payment_method = 'credit' then
      -- Reverse the credit balance
      update public.customers
         set balance = balance - v_old_total,
             updated_at = now()
       where id = v_old_customer_id;
    end if;
    
    -- Recalculate running balances for old customer
    update public.customer_ledger cl
    set balance = sub.run_bal
    from (
      select id, sum(debit - credit) over (partition by customer_id order by created_at, id) as run_bal
      from public.customer_ledger
      where customer_id = v_old_customer_id
    ) sub
    where cl.id = sub.id and cl.customer_id = v_old_customer_id;
    
    update public.customers c
    set balance = coalesce((
      select balance from public.customer_ledger 
      where customer_id = v_old_customer_id 
      order by created_at desc, id desc limit 1
    ), 0)
    where id = v_old_customer_id;
  end if;

  -- 6. Insert new items and deduct new stock
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
      select p_txn_id, id, name, sku, v_qty, v_unit_price, v_item_discount, v_line_total
        from public.products where id = v_product_id;
    else
      -- Negative quantity = refund/return of stock
      update public.products set quantity_on_hand = quantity_on_hand - v_qty, updated_at = now()
        where id = v_product_id;
      insert into public.transaction_items
        (transaction_id, product_id, product_name, sku, quantity, unit_price, discount, line_total)
      select p_txn_id, id, name, sku, v_qty, v_unit_price, v_item_discount, v_line_total
        from public.products where id = v_product_id;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_qty);
    v_discount := v_discount + v_item_discount;
  end loop;

  v_tax := round(v_subtotal * coalesce(p_tax_rate, 0), 2);
  v_total := round(v_subtotal - v_discount + v_tax, 2);
  v_change := greatest(0, p_amount_tendered - v_total);

  -- 7. Update transaction record
  update public.transactions
     set customer_id = p_customer_id,
         payment_method = p_payment_method,
         amount_tendered = p_amount_tendered,
         card_amount = coalesce(p_card_amount, 0),
         tax_rate = coalesce(p_tax_rate, 0),
         subtotal = v_subtotal,
         discount = v_discount,
         tax = v_tax,
         total = v_total,
         change_due = v_change,
         created_at = v_effective_date
   where id = p_txn_id;

  -- 8. Apply new ledger entries and balance for new customer
  if p_customer_id is not null then
    if p_payment_method = 'credit' then
      update public.customers set balance = balance + v_total, updated_at = now() where id = p_customer_id;
      select balance into v_cust_balance from public.customers where id = p_customer_id;
      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance, created_at)
      values (p_customer_id, 'sale', p_txn_id, 'Credit Sale - Receipt #' || v_receipt || ' (Updated)', v_total, 0, v_cust_balance, v_effective_date);
    else
      select balance into v_cust_balance from public.customers where id = p_customer_id;
      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance, created_at)
      values (p_customer_id, 'sale', p_txn_id, 'Sale - Receipt #' || v_receipt || ' (Updated)', v_total, v_total, v_cust_balance, v_effective_date);
    end if;
    
    -- Recalculate running balances for new customer
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
    where id = p_customer_id;
  end if;

  return jsonb_build_object('id', p_txn_id, 'receipt_number', v_receipt, 'total', v_total);
END;
$$;
