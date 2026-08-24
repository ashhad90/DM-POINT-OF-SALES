// Minimal RFC 4180-style CSV parser (handles quotes, embedded commas/newlines).
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  return rows
}

// Map a CSV row (array) to a product payload using the header names.
export function csvRowToProduct(headers, row) {
  const get = (name) => {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase())
    return idx >= 0 ? (row[idx] || '').trim() : ''
  }
  return {
    name: get('name'),
    sku: get('sku'),
    barcode: get('barcode'),
    category: get('category'),
    cost_price: parseFloat(get('cost price')) || 0,
    sale_price: parseFloat(get('sale price')) || 0,
    quantity_on_hand: parseInt(get('quantity'), 10) || 0,
    reorder_threshold: parseInt(get('reorder threshold'), 10) || 0,
    supplier: get('supplier')
  }
}
