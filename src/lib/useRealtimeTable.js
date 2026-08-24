import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Subscribes to realtime changes on a table and returns rows.
// Falls back silently to a plain fetch when realtime is unavailable.
export function useRealtimeTable(table, query = (q) => q) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let channel

    const fetchRows = async () => {
      const { data, error } = await query(supabase.from(table).select('*'))
      if (error) {
        console.error(`useRealtimeTable(${table}) fetch error:`, error.message)
      } else if (mounted) {
        setRows(data || [])
      }
      if (mounted) setLoading(false)
    }

    fetchRows()

    channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => fetchRows()
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [table])

  return { rows, loading }
}
