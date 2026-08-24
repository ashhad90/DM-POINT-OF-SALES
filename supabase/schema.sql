-- ============================================================
-- Store POS — Schema
-- Run this in the Supabase SQL editor.
-- App-level auth: roles are stored in the profiles table and
-- enforced by RLS policies + the has_role() helper.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Custom types ----------
create type payment_method as enum ('cash', 'card', 'split', 'credit');
create type stock_reason as enum ('restock', 'damage', 'correction');
create type txn_status as enum ('completed', 'voided', 'refunded');

-- ---------- Profiles (one row per auth user) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Helper: current user role ----------
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = role_name
  );
$$;

-- Enable RLS and add policies on profiles (after has_role is created to resolve circular dependency)
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.has_role('admin'));
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ---------- Categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_all" on public.categories
  for all using (true) with check (true);

-- ---------- Suppliers ----------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text not null default '',
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "suppliers_all" on public.suppliers
  for all using (true) with check (true);

-- ---------- Products ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  barcode text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  cost_price numeric(12, 2) not null default 0,
  sale_price numeric(12, 2) not null default 0,
  quantity_on_hand integer not null default 0,
  reorder_threshold integer not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "products_all" on public.products
  for all using (true) with check (true);

create index products_name_idx on public.products using gin (to_tsvector('simple', name));
create index products_sku_idx on public.products (sku);
create index products_barcode_idx on public.products (barcode);
create index products_category_idx on public.products (category_id);

-- ---------- Customers ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "customers_all" on public.customers
  for all using (true) with check (true);

create index customers_phone_idx on public.customers (phone);

-- ---------- Transactions ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  cashier_id uuid references public.profiles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  tax_rate numeric(5, 4) not null default 0,
  payment_method payment_method not null,
  amount_tendered numeric(12, 2) not null default 0,
  change_due numeric(12, 2) not null default 0,
  card_amount numeric(12, 2) not null default 0,
  status txn_status not null default 'completed',
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text not null default ''
);

alter table public.transactions enable row level security;

create policy "transactions_all" on public.transactions
  for all using (true) with check (true);

create index transactions_created_idx on public.transactions (created_at desc);
create index transactions_customer_idx on public.transactions (customer_id);

-- ---------- Transaction items (line items, audit trail) ----------
create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  sku text not null default '',
  quantity integer not null check (quantity <> 0),
  unit_price numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0
);

alter table public.transaction_items enable row level security;

create policy "transaction_items_all" on public.transaction_items
  for all using (true) with check (true);

create index transaction_items_txn_idx on public.transaction_items (transaction_id);

-- ---------- Customer Ledger ----------
create table public.customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('sale', 'payment', 'void', 'refund')),
  reference_id uuid,
  description text not null default '',
  debit numeric(12, 2) not null default 0,
  credit numeric(12, 2) not null default 0,
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.customer_ledger enable row level security;
create policy "customer_ledger_all" on public.customer_ledger for all using (true) with check (true);
create index customer_ledger_customer_idx on public.customer_ledger (customer_id);
create index customer_ledger_created_idx on public.customer_ledger (created_at desc);

-- ---------- Stock adjustments (audit log) ----------
create table public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_change integer not null,
  reason stock_reason not null,
  note text not null default '',
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.stock_adjustments enable row level security;

create policy "stock_adjustments_all" on public.stock_adjustments
  for all using (true) with check (true);

create index stock_adjustments_product_idx on public.stock_adjustments (product_id);

-- ---------- RPC: record a sale (atomic stock deduction) ----------
-- Returns the created transaction id + receipt number, or raises if
-- there is not enough stock for any line item.
create or replace function public.record_sale(
  p_customer_id uuid,
  p_payment_method payment_method,
  p_amount_tendered numeric,
  p_card_amount numeric default 0,
  p_tax_rate numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  -- Validate credit conditions
  if p_payment_method = 'credit' and p_customer_id is null then
    raise exception 'CUSTOMER_REQUIRED_FOR_CREDIT';
  end if;

  -- Create the transaction shell first
  v_receipt := to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
  insert into public.transactions (receipt_number, cashier_id, customer_id, payment_method, amount_tendered, card_amount, tax_rate)
  values (v_receipt, auth.uid(), p_customer_id, p_payment_method, p_amount_tendered, coalesce(p_card_amount, 0), coalesce(p_tax_rate, 0))
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
      if v_stock is null then
        raise exception 'PRODUCT_NOT_FOUND:%', v_product_id;
      end if;
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
      -- Credit sale: increase customer's outstanding balance
      update public.customers
         set balance = balance + v_total
       where id = p_customer_id;
      
      select balance into v_cust_balance from public.customers where id = p_customer_id;

      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance)
      values (p_customer_id, 'sale', v_txn_id, 'Credit Sale - Receipt #' || v_receipt, v_total, 0, v_cust_balance);
    else
      -- Cash/Card sale: balance does not change, but record in ledger for completeness
      select balance into v_cust_balance from public.customers where id = p_customer_id;
      
      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance)
      values (p_customer_id, 'sale', v_txn_id, 'Sale - Receipt #' || v_receipt, v_total, v_total, v_cust_balance);
    end if;
  end if;

  return jsonb_build_object('id', v_txn_id, 'receipt_number', v_receipt, 'total', v_total);
end;
$$;

-- ---------- RPC: void/refund a transaction (restores stock) ----------
create or replace function public.void_transaction(p_txn_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_total numeric;
  v_payment_method payment_method;
  v_receipt text;
  v_new_balance numeric;
begin
  if not exists (select 1 from public.transactions where id = p_txn_id and status = 'completed') then
    raise exception 'TRANSACTION_NOT_COMPLETED';
  end if;

  select customer_id, total, payment_method, receipt_number
    into v_customer_id, v_total, v_payment_method, v_receipt
    from public.transactions
   where id = p_txn_id;

  -- Restore stock for sale items, deduct again for return items
  update public.products p
     set quantity_on_hand = quantity_on_hand + ti.quantity,
         updated_at = now()
    from public.transaction_items ti
   where ti.product_id = p.id and ti.transaction_id = p_txn_id;

  update public.transactions
     set status = 'voided',
          voided_at = now(),
          voided_by = auth.uid(),
          void_reason = coalesce(p_reason, '')
   where id = p_txn_id;

  -- Reverse credit sale if customer balance is impacted
  if v_customer_id is not null then
    if v_payment_method = 'credit' then
      update public.customers
         set balance = balance - v_total
       where id = v_customer_id;

      select balance into v_new_balance from public.customers where id = v_customer_id;

      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance)
      values (v_customer_id, 'void', p_txn_id, 'Void Credit Sale - Receipt #' || v_receipt, 0, v_total, v_new_balance);
    else
      select balance into v_new_balance from public.customers where id = v_customer_id;

      insert into public.customer_ledger (customer_id, type, reference_id, description, debit, credit, balance)
      values (v_customer_id, 'void', p_txn_id, 'Void Sale - Receipt #' || v_receipt, 0, 0, v_new_balance);
    end if;
  end if;
end;
$$;

-- ---------- RPC: record a customer payment ----------
create or replace function public.record_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance numeric;
  v_ref_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  update public.customers
     set balance = balance - p_amount
   where id = p_customer_id;

  select balance into v_new_balance from public.customers where id = p_customer_id;

  -- Insert payment ledger entry
  insert into public.customer_ledger (customer_id, type, description, debit, credit, balance)
  values (
    p_customer_id,
    'payment',
    coalesce(nullif(p_note, ''), 'Payment received via ' || initcap(p_payment_method)),
    0,
    p_amount,
    v_new_balance
  )
  returning id into v_ref_id;

  return jsonb_build_object('success', true, 'new_balance', v_new_balance, 'ledger_id', v_ref_id);
end;
$$;

-- ---------- Seed: demo users (passwords are set in the SQL editor) ----------
-- Run once, then set a password for each from Dashboard > Authentication:
--   update auth.users set raw_user_meta_data = '{"role":"admin"}' where email = 'admin@pos.local';
-- The profiles trigger below copies the role into the profiles table.
-- If your project predates the trigger, re-insert the profile rows manually.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'cashier')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed categories + suppliers
insert into public.categories (name) values
  ('Beverages'), ('Snacks'), ('Dairy'), ('Bakery'), ('Produce'), ('Household'), ('Personal Care')
on conflict (name) do nothing;

insert into public.suppliers (name, contact) values
  ('Fresh Farms Co.', 'orders@freshfarms.example'),
  ('Snack Central', 'sales@snackcentral.example'),
  ('Daily Dairy Ltd.', 'hello@dailydairy.example'),
  ('HomeGoods Inc.', 'support@homegoods.example')
on conflict (name) do nothing;

-- ---------- Expenses (shop expense tracking) ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null default 'other' check (category in ('rent', 'utilities', 'salaries', 'other')),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.expenses enable row level security;
create policy "expenses_all" on public.expenses for all using (true) with check (true);
create index expenses_date_idx on public.expenses (date desc);
