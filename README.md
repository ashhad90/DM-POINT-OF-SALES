# Store POS

A full point-of-sale system for retail stores — React + Tailwind CSS front end with Supabase for auth, database, and realtime stock updates. Designed for fast touch-based checkout on tablets plus a full back-office on desktop.

## Features

- **Products & inventory** — full CRUD, SKU/barcode lookup, categories, suppliers, CSV bulk import, stock adjustments with reason audit (restock / damage / correction), low-stock alerts
- **Checkout** — scan or search to add items, per-item and order-level discounts, cash/card/split payment with change due, automatic stock deduction, printable/emailable receipt, void & refund with stock restoration
- **Customers** — lookup or create at checkout, per-customer purchase history
- **Dashboard & reports** — revenue KPIs, 14-day sales chart, best sellers, sales by category, inventory value, low-stock report
- **Users & roles** — Admin (full access) and Cashier (sales + stock view only), user invites from Settings
- **Realtime** — product/stock changes propagate instantly across open devices via Supabase Realtime

## Tech stack

- Vite + React 18 + React Router
- Tailwind CSS
- Supabase (auth, Postgres, RLS, RPC, Realtime)
- Recharts (reporting charts)
- lucide-react (icons)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run everything in [`supabase/schema.sql`](supabase/schema.sql). This creates tables, RLS policies, RPC functions (`record_sale`, `void_transaction`), triggers, and seed categories/suppliers.
3. Enable **Realtime**: Dashboard → Database → Replication → enable replication for the `products`, `categories`, `suppliers`, and `profiles` tables (optional for `transactions`).
4. Create two users (Admin → Authentication → Add user), e.g.:
   - `admin@pos.local` / your password
   - `cashier@pos.local` / your password

   For each user, set their role in **Authentication → Users → Edit → Raw user meta data**:
   ```json
   { "role": "admin" }
   ```
   The `handle_new_user` trigger copies the role into the `profiles` table, which drives app permissions. Existing users created before the trigger can be updated with:
   ```sql
   insert into public.profiles (id, full_name, role)
   select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'role'
   from auth.users
   on conflict (id) do nothing;
   ```

### 2. App

1. `cp .env.example .env` and fill in your project URL and anon key (Dashboard → Settings → API).
2. `npm install`
3. `npm run dev`

> Note: if your shell has `NODE_ENV=production` set, use `npm install --include=dev`.

## Usage

- **Checkout** — type or scan a barcode to add items. Adjust quantities in the cart, attach a customer, apply discounts, and hit **Charge**. Cash payments show change due. After the sale, print or email the receipt. Use **Recent sales** → void icon to void a transaction (stock is restored automatically).
- **Products** — add/edit/delete products, adjust stock with a reason, import via CSV (template downloadable in the import dialog), and filter by category or low-stock status.
- **Reports** — switch between 7/30/90-day views; low-stock report included.
- **Settings** — set store name/address/tax rate (used on receipts), invite users, and change roles.

## Role permissions

| Capability | Admin | Cashier |
|---|---|---|
| Process sales | ✓ | ✓ |
| View stock levels | ✓ | ✓ |
| Add/edit/delete products | ✓ | |
| Stock adjustments | ✓ | |
| Customers | ✓ | |
| Dashboard & reports | ✓ | |
| Void transactions | ✓ | |
| Manage users | ✓ | |

## Security notes

- Row-level security is enabled on all tables; `record_sale` and `void_transaction` are `security definer` RPCs so stock changes only happen through validated paths.
- Receipt store settings live in `localStorage` — fine for a single-store deployment. The user-invite flow uses Supabase Auth sign-up; a production deployment should move to an Edge Function using the service-role key and email confirmation.
- Cashier permissions are enforced client-side via the `isAdmin` guard and server-side via the `has_role()` policy helper.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
