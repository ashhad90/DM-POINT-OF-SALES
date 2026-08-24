import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtimeTable } from '../lib/useRealtimeTable'

const ProductContext = createContext(null)

export function ProductProvider({ children }) {
  const productsQuery = useRealtimeTable('products')
  const categoriesQuery = useRealtimeTable('categories')
  const suppliersQuery = useRealtimeTable('suppliers')
  const [adjustments, setAdjustments] = useState([])

  const { rows: products, loading } = productsQuery
  const { rows: categories } = categoriesQuery
  const { rows: suppliers } = suppliersQuery

  // Low stock = quantity at or below reorder threshold
  const lowStock = products.filter((p) => p.active && p.quantity_on_hand <= p.reorder_threshold)

  useEffect(() => {
    let mounted = true
    supabase
      .from('stock_adjustments')
      .select('*, product:products(id, name, sku)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => mounted && setAdjustments(data || []))
    return () => {
      mounted = false
    }
  }, [])

  const saveProduct = async (payload) => {
    const { id, ...rest } = payload
    if (id) {
      const { error } = await supabase.from('products').update(rest).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('products').insert(rest)
      if (error) throw error
    }
  }

  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
  }

  const adjustStock = async ({ productId, delta, reason, note }) => {
    if (!delta) return
    const { error: adjErr } = await supabase.from('stock_adjustments').insert({
      product_id: productId,
      quantity_change: delta,
      reason,
      note: note || ''
    })
    if (adjErr) throw adjErr

    const { error: updErr } = await supabase
      .from('products')
      .update({ quantity_on_hand: supabase.rpc('increment', { x: delta }) })
      .eq('id', productId)
    if (updErr) throw updErr

    setAdjustments((prev) => [
      {
        id: Date.now(),
        quantity_change: delta,
        reason,
        note: note || '',
        product: null
      },
      ...prev
    ].slice(0, 50))
  }

  const upsertCategory = async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('categories').insert({ name: trimmed }).select().single()
    if (error) throw error
    return data
  }

  const upsertSupplier = async (name, contact = '') => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const existing = suppliers.find((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('suppliers').insert({ name: trimmed, contact }).select().single()
    if (error) throw error
    return data
  }

  const value = {
    products,
    loading,
    categories,
    suppliers,
    lowStock,
    adjustments,
    saveProduct,
    deleteProduct,
    adjustStock,
    upsertCategory,
    upsertSupplier
  }

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export const useProducts = () => useContext(ProductContext)
