import { useRef, useState } from 'react'
import { Upload, Download } from 'lucide-react'
import Modal from '../ui/Modal'
import { parseCSV, csvRowToProduct } from '../../lib/csv'
import { useProducts } from '../../context/ProductContext'
import { useToast } from '../../context/ToastContext'

const TEMPLATE = `name,sku,barcode,category,sale price,cost price,quantity,reorder threshold,supplier
Green Tea Box,SKU-1001,,Beverages,4.99,2.50,50,10,Fresh Farms Co.
Potato Chips,SKU-1002,,Snacks,3.49,1.80,80,15,Snack Central
Whole Milk 1L,SKU-1003,,Dairy,2.99,1.60,40,12,Daily Dairy Ltd.
`

export default function ImportCSV({ open, onClose }) {
  const { categories, suppliers, saveProduct, upsertCategory, upsertSupplier } = useProducts()
  const { push } = useToast()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null) // { headers, rows }
  const [importing, setImporting] = useState(false)

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parseCSV(String(reader.result))
      if (rows.length < 2) {
        push('CSV needs a header row and at least one product', 'error')
        return
      }
      setPreview({ headers: rows[0], rows: rows.slice(1) })
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importAll = async () => {
    if (!preview) return
    setImporting(true)
    let ok = 0
    let failed = 0
    const errors = []
    for (const row of preview.rows) {
      try {
        const p = csvRowToProduct(preview.headers, row)
        if (!p.name || !p.sku) throw new Error('name and sku are required')
        const catId = p.category ? (await upsertCategory(p.category))?.id : null
        const supId = p.supplier ? (await upsertSupplier(p.supplier))?.id : null
        await saveProduct({ ...p, category_id: catId, supplier_id: supId, active: true })
        ok++
      } catch (err) {
        failed++
        errors.push(`${p?.sku || '?'}: ${err.message}`)
      }
    }
    push(`Imported ${ok} product${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`, failed ? 'info' : 'success')
    if (errors.length) console.error('CSV import errors:', errors)
    setPreview(null)
    setImporting(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Import products from CSV" size="lg">
      <div className="space-y-4">
        <button onClick={downloadTemplate} className="btn-secondary">
          <Download size={16} /> Download CSV template
        </button>
        <p className="text-xs text-slate-500">
          Columns: <code className="rounded bg-slate-100 px-1 py-0.5">name, sku, barcode, category, sale price, cost price, quantity, reorder threshold, supplier</code>
        </p>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="btn-primary">
          <Upload size={16} /> Choose CSV file
        </button>

        {preview && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
              {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} ready to import
            </p>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>{preview.headers.map((h, i) => <th key={i} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {r.map((c, j) => <td key={j} className="px-4 py-1.5">{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={importAll} disabled={!preview || importing} className="btn-primary">
            {importing ? 'Importing…' : `Import ${preview?.rows.length || 0} products`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
