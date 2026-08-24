import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isDemo = !url || url.includes('placeholder') || !anonKey || anonKey.includes('placeholder')

if (isDemo) {
  console.log('Running in Offline Demo Mode with localStorage database.')
} else {
  console.log('Running in Online Cloud Mode connected to Supabase.')
}

// --- Local Storage Mock Database ---

const defaultCategories = [
  { id: 'cat-1', name: 'Beverages', created_at: new Date().toISOString() },
  { id: 'cat-2', name: 'Snacks', created_at: new Date().toISOString() },
  { id: 'cat-3', name: 'Dairy', created_at: new Date().toISOString() },
  { id: 'cat-4', name: 'Bakery', created_at: new Date().toISOString() },
  { id: 'cat-5', name: 'Produce', created_at: new Date().toISOString() },
  { id: 'cat-6', name: 'Household', created_at: new Date().toISOString() },
  { id: 'cat-7', name: 'Personal Care', created_at: new Date().toISOString() }
]

const defaultSuppliers = [
  { id: 'sup-1', name: 'Fresh Farms Co.', contact: 'orders@freshfarms.example', created_at: new Date().toISOString() },
  { id: 'sup-2', name: 'Snack Central', contact: 'sales@snackcentral.example', created_at: new Date().toISOString() },
  { id: 'sup-3', name: 'Daily Dairy Ltd.', contact: 'hello@dailydairy.example', created_at: new Date().toISOString() },
  { id: 'sup-4', name: 'HomeGoods Inc.', contact: 'support@homegoods.example', created_at: new Date().toISOString() }
]

const defaultProducts = [
  { id: 'prod-1', name: 'Coca-Cola 12oz', sku: 'COKE-12OZ', barcode: '049000000443', category_id: 'cat-1', cost_price: 0.80, sale_price: 1.99, quantity_on_hand: 50, reorder_threshold: 10, supplier_id: 'sup-2', image_url: '', active: true, created_at: new Date().toISOString() },
  { id: 'prod-2', name: 'Potato Chips Lays', sku: 'CHIP-LAYS', barcode: '028400090856', category_id: 'cat-2', cost_price: 1.50, sale_price: 3.49, quantity_on_hand: 30, reorder_threshold: 8, supplier_id: 'sup-2', image_url: '', active: true, created_at: new Date().toISOString() },
  { id: 'prod-3', name: 'Whole Milk 1 Gal', sku: 'MILK-1GAL', barcode: '078742351866', category_id: 'cat-3', cost_price: 2.10, sale_price: 4.29, quantity_on_hand: 12, reorder_threshold: 5, supplier_id: 'sup-3', image_url: '', active: true, created_at: new Date().toISOString() },
  { id: 'prod-4', name: 'Sliced White Bread', sku: 'BREAD-WHT', barcode: '072250037125', category_id: 'cat-4', cost_price: 1.20, sale_price: 2.79, quantity_on_hand: 20, reorder_threshold: 5, supplier_id: 'sup-3', image_url: '', active: true, created_at: new Date().toISOString() },
  { id: 'prod-5', name: 'Fresh Bananas (1 lb)', sku: 'BANANA-LB', barcode: '4011', category_id: 'cat-5', cost_price: 0.25, sale_price: 0.69, quantity_on_hand: 100, reorder_threshold: 20, supplier_id: 'sup-1', image_url: '', active: true, created_at: new Date().toISOString() },
  { id: 'prod-6', name: 'Paper Towels 6pk', sku: 'PAPER-TOWEL', barcode: '037000304924', category_id: 'cat-6', cost_price: 4.50, sale_price: 8.99, quantity_on_hand: 4, reorder_threshold: 5, supplier_id: 'sup-4', image_url: '', active: true, created_at: new Date().toISOString() }
]

const defaultCustomers = [
  { id: 'cust-1', name: 'Jane Doe', phone: '555-0199', email: 'jane@example.com', notes: 'Frequent customer', balance: 120.00, created_at: new Date().toISOString() },
  { id: 'cust-2', name: 'John Smith', phone: '555-0144', email: 'john@example.com', notes: '', balance: 0.00, created_at: new Date().toISOString() }
]

const defaultProfiles = [
  { id: 'demo-admin', full_name: 'Store Admin', role: 'admin', created_at: new Date().toISOString() },
  { id: 'demo-cashier', full_name: 'Cashier User', role: 'cashier', created_at: new Date().toISOString() }
]

const defaultLedger = [
  {
    id: 'led-1',
    customer_id: 'cust-1',
    type: 'sale',
    reference_id: null,
    description: 'Initial Balance/Pre-existing Credit Sale',
    debit: 120.00,
    credit: 0,
    balance: 120.00,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  }
]

function initializeMockDb() {
  if (!localStorage.getItem('pos_mock_initialized')) {
    localStorage.setItem('pos_mock_categories', JSON.stringify(defaultCategories))
    localStorage.setItem('pos_mock_suppliers', JSON.stringify(defaultSuppliers))
    localStorage.setItem('pos_mock_products', JSON.stringify(defaultProducts))
    localStorage.setItem('pos_mock_customers', JSON.stringify(defaultCustomers))
    localStorage.setItem('pos_mock_profiles', JSON.stringify(defaultProfiles))
    localStorage.setItem('pos_mock_customer_ledger', JSON.stringify(defaultLedger))
    localStorage.setItem('pos_mock_transactions', JSON.stringify([]))
    localStorage.setItem('pos_mock_transaction_items', JSON.stringify([]))
    localStorage.setItem('pos_mock_stock_adjustments', JSON.stringify([]))
    localStorage.setItem('pos_mock_expenses', JSON.stringify([]))
    localStorage.setItem('pos_mock_initialized', 'true')
  }
  if (!localStorage.getItem('pos_mock_expenses')) {
    localStorage.setItem('pos_mock_expenses', JSON.stringify([]))
  }
}

if (isDemo && typeof window !== 'undefined') {
  initializeMockDb()
}

// Pub/Sub for realtime emulation
const listeners = {}

function triggerTableChange(table) {
  if (listeners[table]) {
    listeners[table].forEach(callback => {
      try {
        callback()
      } catch (err) {
        console.error('Error in realtime subscription callback:', err)
      }
    })
  }
}

class QueryBuilder {
  constructor(table) {
    this.table = table
    this.filters = []
    this.orderByField = null
    this.orderAscending = true
    this.limitCount = null
    this.action = 'select'
    this.payload = null
    this.columns = '*'
    this.isSingle = false
    this.isMaybeSingle = false
  }

  select(columns = '*') {
    this.action = 'select'
    this.columns = columns
    return this
  }

  insert(payload) {
    this.action = 'insert'
    this.payload = payload
    return this
  }

  update(payload) {
    this.action = 'update'
    this.payload = payload
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, value: values })
    return this
  }

  order(column, { ascending = true } = {}) {
    this.orderByField = column
    this.orderAscending = ascending
    return this
  }

  limit(count) {
    this.limitCount = count
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  async then(onfulfilled, onrejected) {
    try {
      const result = await this.execute()
      return onfulfilled ? onfulfilled(result) : result
    } catch (err) {
      if (onrejected) return onrejected(err)
      throw err
    }
  }

  async execute() {
    const storageKey = `pos_mock_${this.table}`
    let rows = JSON.parse(localStorage.getItem(storageKey) || '[]')

    if (this.action === 'select') {
      // Apply filters
      for (const filter of this.filters) {
        if (filter.type === 'eq') {
          rows = rows.filter(r => r[filter.column] === filter.value)
        } else if (filter.type === 'in') {
          rows = rows.filter(r => filter.value.includes(r[filter.column]))
        }
      }

      // Handle relations (simple joins)
      rows = rows.map(row => {
        const copy = { ...row }
        if (this.table === 'transactions') {
          const customers = JSON.parse(localStorage.getItem('pos_mock_customers') || '[]')
          const profiles = JSON.parse(localStorage.getItem('pos_mock_profiles') || '[]')
          if (copy.customer_id) {
            copy.customer = customers.find(c => c.id === copy.customer_id) || null
          } else {
            copy.customer = null
          }
          if (copy.cashier_id) {
            copy.cashier = profiles.find(p => p.id === copy.cashier_id) || null
          } else {
            copy.cashier = null
          }
        } else if (this.table === 'stock_adjustments') {
          const products = JSON.parse(localStorage.getItem('pos_mock_products') || '[]')
          if (copy.product_id) {
            copy.product = products.find(p => p.id === copy.product_id) || null
          } else {
            copy.product = null
          }
        }
        return copy
      })

      // Sort
      if (this.orderByField) {
        rows.sort((a, b) => {
          let valA = a[this.orderByField]
          let valB = b[this.orderByField]
          if (typeof valA === 'string') {
            return this.orderAscending ? valA.localeCompare(valB) : valB.localeCompare(valA)
          }
          return this.orderAscending ? valA - valB : valB - valA
        })
      }

      // Limit
      if (this.limitCount !== null) {
        rows = rows.slice(0, this.limitCount)
      }

      if (this.isSingle) {
        if (rows.length === 0) return { data: null, error: { message: 'Not found' } }
        return { data: rows[0], error: null }
      }

      if (this.isMaybeSingle) {
        return { data: rows.length > 0 ? rows[0] : null, error: null }
      }

      return { data: rows, error: null }

    } else if (this.action === 'insert') {
      const dataToInsert = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = []

      for (const item of dataToInsert) {
        const newItem = {
          id: item.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...item
        }
        rows.push(newItem)
        inserted.push(newItem)
      }

      localStorage.setItem(storageKey, JSON.stringify(rows))
      triggerTableChange(this.table)
      return { data: Array.isArray(this.payload) ? inserted : inserted[0], error: null }

    } else if (this.action === 'update') {
      let affected = []
      const updatedRows = rows.map(r => {
        let matches = true
        for (const filter of this.filters) {
          if (filter.type === 'eq' && r[filter.column] !== filter.value) {
            matches = false
          }
        }
        if (matches) {
          const updatedItem = { ...r }
          for (const key of Object.keys(this.payload)) {
            const val = this.payload[key]
            if (val && typeof val === 'object' && '_rpc_increment' in val) {
              updatedItem[key] = (updatedItem[key] || 0) + val._rpc_increment
            } else {
              updatedItem[key] = val
            }
          }
          updatedItem.updated_at = new Date().toISOString()
          affected.push(updatedItem)
          return updatedItem
        }
        return r
      })

      localStorage.setItem(storageKey, JSON.stringify(updatedRows))
      triggerTableChange(this.table)
      return { data: affected, error: null }

    } else if (this.action === 'delete') {
      const remainingRows = rows.filter(r => {
        let matches = true
        for (const filter of this.filters) {
          if (filter.type === 'eq' && r[filter.column] !== filter.value) {
            matches = false
          }
        }
        return !matches
      })

      localStorage.setItem(storageKey, JSON.stringify(remainingRows))
      triggerTableChange(this.table)
      return { data: null, error: null }
    }
  }
}

class LocalSupabaseClient {
  constructor() {
    this.auth = {
      getSession: async () => {
        const user = JSON.parse(localStorage.getItem('pos_mock_user') || 'null') || { id: 'demo-admin', email: 'dabeer337@gmail.com' }
        return { data: { session: user ? { user } : null } }
      },
      onAuthStateChange: (callback) => {
        // dummy sub
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signInWithPassword: async ({ email, password }) => {
        let user
        if (email === 'dabeer337@gmail.com') {
          user = { id: 'demo-admin', email: 'dabeer337@gmail.com' }
        } else if (email === 'cashier@pos.local') {
          user = { id: 'demo-cashier', email: 'cashier@pos.local' }
        } else {
          return { error: { message: 'Invalid credentials' } }
        }
        localStorage.setItem('pos_mock_user', JSON.stringify(user))
        return { data: { user } }
      },
      signOut: async () => {
        localStorage.removeItem('pos_mock_user')
        return { error: null }
      }
    }
  }

  channel(name) {
    const parts = name.split('-')
    const table = parts[1]
    return {
      on: (event, filter, callback) => {
        if (!listeners[table]) {
          listeners[table] = []
        }
        listeners[table].push(callback)
        return {
          subscribe: () => {
            return {
              unsubscribe: () => {
                listeners[table] = (listeners[table] || []).filter(cb => cb !== callback)
              }
            }
          }
        }
      },
      subscribe: () => {
        return this
      }
    }
  }

  removeChannel(channel) {}

  rpc(fn, args) {
    if (fn === 'record_sale') {
      return this.record_sale(args)
    } else if (fn === 'void_transaction') {
      return this.void_transaction(args)
    } else if (fn === 'record_payment') {
      return this.record_payment(args)
    } else if (fn === 'increment') {
      return { _rpc_increment: args.x }
    }
    return Promise.resolve({ data: null, error: null })
  }

  from(table) {
    return new QueryBuilder(table)
  }

  record_sale(args) {
    const { p_customer_id, p_payment_method, p_amount_tendered, p_card_amount, p_tax_rate, p_items } = args

    const products = JSON.parse(localStorage.getItem('pos_mock_products') || '[]')
    const transactions = JSON.parse(localStorage.getItem('pos_mock_transactions') || '[]')
    const transaction_items = JSON.parse(localStorage.getItem('pos_mock_transaction_items') || '[]')

    for (const item of p_items) {
      const prod = products.find(p => p.id === item.product_id)
      if (!prod) {
        return Promise.resolve({ data: null, error: { message: `PRODUCT_NOT_FOUND:${item.product_id}` } })
      }
      if (item.quantity > 0 && prod.quantity_on_hand < item.quantity) {
        return Promise.resolve({ data: null, error: { message: `INSUFFICIENT_STOCK:${item.product_id}:${prod.quantity_on_hand}` } })
      }
    }

    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    const receipt_number = `${yy}${mm}${dd}-${rand}`

    const user = JSON.parse(localStorage.getItem('pos_mock_user') || 'null') || { id: 'demo-admin' }
    const txn_id = crypto.randomUUID()

    let subtotal = 0
    let discount = 0

    for (const item of p_items) {
      const prod = products.find(p => p.id === item.product_id)
      prod.quantity_on_hand -= item.quantity
      prod.updated_at = new Date().toISOString()

      const line_total = Math.round(((item.unit_price * item.quantity) - (item.discount || 0)) * 100) / 100
      subtotal += item.unit_price * item.quantity
      discount += item.discount || 0

      transaction_items.push({
        id: crypto.randomUUID(),
        transaction_id: txn_id,
        product_id: item.product_id,
        product_name: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount || 0,
        line_total
      })
    }

    const tax_rate = p_tax_rate || 0
    const tax = Math.round((subtotal * tax_rate) * 100) / 100
    const total = Math.round((subtotal - discount + tax) * 100) / 100
    const change_due = Math.max(0, p_amount_tendered - total)

    const newTxn = {
      id: txn_id,
      receipt_number,
      cashier_id: user.id,
      customer_id: p_customer_id || null,
      subtotal,
      discount,
      tax,
      total,
      tax_rate,
      payment_method: p_payment_method,
      amount_tendered: p_amount_tendered,
      change_due,
      card_amount: p_card_amount || 0,
      status: 'completed',
      created_at: new Date().toISOString(),
      voided_at: null,
      voided_by: null,
      void_reason: ''
    }

    transactions.push(newTxn)

    localStorage.setItem('pos_mock_products', JSON.stringify(products))
    localStorage.setItem('pos_mock_transactions', JSON.stringify(transactions))
    localStorage.setItem('pos_mock_transaction_items', JSON.stringify(transaction_items))

    // Handle ledger and customer balance updates in Mock Mode
    if (p_customer_id) {
      const customers = JSON.parse(localStorage.getItem('pos_mock_customers') || '[]')
      const ledger = JSON.parse(localStorage.getItem('pos_mock_customer_ledger') || '[]')
      const customer = customers.find(c => c.id === p_customer_id)
      if (customer) {
        if (p_payment_method === 'credit') {
          customer.balance = Math.round((customer.balance + total) * 100) / 100
        }
        customer.updated_at = new Date().toISOString()
        
        ledger.push({
          id: crypto.randomUUID(),
          customer_id: p_customer_id,
          type: 'sale',
          reference_id: txn_id,
          description: p_payment_method === 'credit' ? `Credit Sale - Receipt #${receipt_number}` : `Sale - Receipt #${receipt_number}`,
          debit: total,
          credit: p_payment_method === 'credit' ? 0 : total,
          balance: customer.balance,
          created_at: new Date().toISOString()
        })
        
        localStorage.setItem('pos_mock_customers', JSON.stringify(customers))
        localStorage.setItem('pos_mock_customer_ledger', JSON.stringify(ledger))
      }
    }

    setTimeout(() => {
      triggerTableChange('products')
      triggerTableChange('transactions')
      triggerTableChange('transaction_items')
      triggerTableChange('customers')
      triggerTableChange('customer_ledger')
    }, 0)

    return Promise.resolve({ data: { id: txn_id, receipt_number, total }, error: null })
  }

  void_transaction(args) {
    const { p_txn_id, p_reason } = args

    const products = JSON.parse(localStorage.getItem('pos_mock_products') || '[]')
    const transactions = JSON.parse(localStorage.getItem('pos_mock_transactions') || '[]')
    const transaction_items = JSON.parse(localStorage.getItem('pos_mock_transaction_items') || '[]')

    const txn = transactions.find(t => t.id === p_txn_id)
    if (!txn || txn.status !== 'completed') {
      return Promise.resolve({ data: null, error: { message: 'TRANSACTION_NOT_COMPLETED' } })
    }

    const txnItems = transaction_items.filter(ti => ti.transaction_id === p_txn_id)
    for (const item of txnItems) {
      const prod = products.find(p => p.id === item.product_id)
      if (prod) {
        prod.quantity_on_hand += item.quantity
        prod.updated_at = new Date().toISOString()
      }
    }

    const user = JSON.parse(localStorage.getItem('pos_mock_user') || 'null') || { id: 'demo-admin' }
    txn.status = 'voided'
    txn.voided_at = new Date().toISOString()
    txn.voided_by = user.id
    txn.void_reason = p_reason || ''

    localStorage.setItem('pos_mock_products', JSON.stringify(products))
    localStorage.setItem('pos_mock_transactions', JSON.stringify(transactions))

    // Handle ledger reversal in Mock Mode
    if (txn.customer_id) {
      const customers = JSON.parse(localStorage.getItem('pos_mock_customers') || '[]')
      const ledger = JSON.parse(localStorage.getItem('pos_mock_customer_ledger') || '[]')
      const customer = customers.find(c => c.id === txn.customer_id)
      if (customer) {
        if (txn.payment_method === 'credit') {
          customer.balance = Math.round((customer.balance - txn.total) * 100) / 100
        }
        customer.updated_at = new Date().toISOString()
        
        ledger.push({
          id: crypto.randomUUID(),
          customer_id: txn.customer_id,
          type: 'void',
          reference_id: p_txn_id,
          description: txn.payment_method === 'credit' ? `Void Credit Sale - Receipt #${txn.receipt_number}` : `Void Sale - Receipt #${txn.receipt_number}`,
          debit: 0,
          credit: txn.payment_method === 'credit' ? txn.total : 0,
          balance: customer.balance,
          created_at: new Date().toISOString()
        })
        
        localStorage.setItem('pos_mock_customers', JSON.stringify(customers))
        localStorage.setItem('pos_mock_customer_ledger', JSON.stringify(ledger))
      }
    }

    setTimeout(() => {
      triggerTableChange('products')
      triggerTableChange('transactions')
      triggerTableChange('customers')
      triggerTableChange('customer_ledger')
    }, 0)

    return Promise.resolve({ data: null, error: null })
  }

  record_payment(args) {
    const { p_customer_id, p_amount, p_payment_method, p_note } = args

    const customers = JSON.parse(localStorage.getItem('pos_mock_customers') || '[]')
    const ledger = JSON.parse(localStorage.getItem('pos_mock_customer_ledger') || '[]')

    const customer = customers.find(c => c.id === p_customer_id)
    if (!customer) {
      return Promise.resolve({ data: null, error: { message: 'CUSTOMER_NOT_FOUND' } })
    }

    customer.balance = Math.round((customer.balance - p_amount) * 100) / 100
    customer.updated_at = new Date().toISOString()

    const ledgerId = crypto.randomUUID()
    ledger.push({
      id: ledgerId,
      customer_id: p_customer_id,
      type: 'payment',
      reference_id: null,
      description: p_note || `Payment received via ${p_payment_method.charAt(0).toUpperCase() + p_payment_method.slice(1)}`,
      debit: 0,
      credit: p_amount,
      balance: customer.balance,
      created_at: new Date().toISOString()
    })

    localStorage.setItem('pos_mock_customers', JSON.stringify(customers))
    localStorage.setItem('pos_mock_customer_ledger', JSON.stringify(ledger))

    setTimeout(() => {
      triggerTableChange('customers')
      triggerTableChange('customer_ledger')
    }, 0)

    return Promise.resolve({ data: { success: true, new_balance: customer.balance, ledger_id: ledgerId }, error: null })
  }
}

export const supabase = isDemo
  ? new LocalSupabaseClient()
  : createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
