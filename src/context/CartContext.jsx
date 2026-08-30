import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

const CartContext = createContext(null)

const initialState = {
  items: [], // { product, quantity, discount }
  orderDiscount: 0,
  taxRate: 0,
  customer: null,
  paymentMethod: 'cash',
  tendered: 0,
  cardAmount: 0
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { product } = action
      const existing = state.items.find((i) => i.product.id === product.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        }
      }
      return { ...state, items: [...state.items, { product, quantity: 1, discount: 0, price: product.sale_price }] }
    }
    case 'SET_QTY': {
      const { id, quantity } = action
      if (quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.product.id !== id) }
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === id ? { ...i, quantity: Math.min(quantity, i.product.quantity_on_hand) } : i
        )
      }
    }
    case 'SET_ITEM_PRICE': {
      const { id, price } = action
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === id ? { ...i, price: Math.max(0, price) } : i
        )
      }
    }
    case 'SET_ITEM_DISCOUNT': {
      const { id, discount } = action
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === id ? { ...i, discount: Math.max(0, discount) } : i
        )
      }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.product.id !== action.id) }
    case 'SET_ORDER_DISCOUNT':
      return { ...state, orderDiscount: Math.max(0, action.discount) }
    case 'SET_TAX_RATE':
      return { ...state, taxRate: Math.max(0, action.rate) }
    case 'SET_CUSTOMER':
      return { ...state, customer: action.customer }
    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.method }
    case 'SET_TENDERED':
      return { ...state, tendered: action.amount }
    case 'SET_CARD_AMOUNT':
      return { ...state, cardAmount: action.amount }
    case 'CLEAR':
      return { ...initialState }
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Pick up the tax rate saved in store settings once on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pos_store_settings')
      if (raw) {
        const settings = JSON.parse(raw)
        if (settings.tax_rate) dispatch({ type: 'SET_TAX_RATE', rate: settings.tax_rate / 100 })
      }
    } catch { /* ignore */ }
  }, [])

  const value = useMemo(() => {
    const subtotal = state.items.reduce(
      (sum, i) => sum + (i.price ?? i.product.sale_price) * i.quantity,
      0
    )
    const itemDiscounts = state.items.reduce((sum, i) => sum + (i.discount || 0), 0)
    const discount = Math.min(itemDiscounts + state.orderDiscount, subtotal)
    const taxable = Math.max(0, subtotal - discount)
    const tax = Math.round(taxable * state.taxRate * 100) / 100
    const total = Math.round((taxable + tax) * 100) / 100

    return {
      ...state,
      subtotal,
      itemDiscounts,
      discount,
      tax,
      total,
      itemCount: state.items.reduce((sum, i) => sum + i.quantity, 0),
      add: (product) => dispatch({ type: 'ADD', product }),
      setQty: (id, quantity) => dispatch({ type: 'SET_QTY', id, quantity }),
      setItemPrice: (id, price) => dispatch({ type: 'SET_ITEM_PRICE', id, price }),
      setItemDiscount: (id, discount) => dispatch({ type: 'SET_ITEM_DISCOUNT', id, discount }),
      remove: (id) => dispatch({ type: 'REMOVE', id }),
      setOrderDiscount: (discount) => dispatch({ type: 'SET_ORDER_DISCOUNT', discount }),
      setTaxRate: (rate) => dispatch({ type: 'SET_TAX_RATE', rate }),
      setCustomer: (customer) => dispatch({ type: 'SET_CUSTOMER', customer }),
      setPaymentMethod: (method) => dispatch({ type: 'SET_PAYMENT_METHOD', method }),
      setTendered: (amount) => dispatch({ type: 'SET_TENDERED', amount }),
      setCardAmount: (amount) => dispatch({ type: 'SET_CARD_AMOUNT', amount }),
      clear: () => dispatch({ type: 'CLEAR' })
    }
  }, [state])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
