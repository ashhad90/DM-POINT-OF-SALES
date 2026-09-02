import { fmtDateTime } from '../lib/format'

// Generates a printable, text-based receipt.
export function renderReceipt(txn, items, store = {}) {
  const lines = []
  const w = 40

  const center = (s) => {
    const pad = Math.max(0, Math.floor((w - s.length) / 2))
    return ' '.repeat(pad) + s
  }
  const padRight = (s, n) => s + ' '.repeat(Math.max(0, n - s.length))

  lines.push(center(store.store_name || 'DM POS'))
  if (store.address) lines.push(center(store.address))
  if (store.phone) lines.push(center(store.phone))
  if (store.tax_label && store.tax_rate != null && store.tax_rate > 0) {
    lines.push(center(`${store.tax_label}: ${(store.tax_rate * 100).toFixed(2)}%`))
  }
  lines.push(''.padEnd(w, '='))
  lines.push(`Receipt:   ${txn.receipt_number}`)
  lines.push(`Date:      ${fmtDateTime(txn.created_at)}`)
  lines.push(`Cashier:   ${txn.cashier?.full_name || '—'}`)
  if (txn.customer) lines.push(`Customer:  ${txn.customer.name}`)
  lines.push(''.padEnd(w, '-'))

  for (const it of items) {
    const qty = Math.abs(it.quantity)
    const price = it.unit_price
    lines.push(it.product_name)
    lines.push(
      padRight(
        `${qty} x ${price.toFixed(2)}${it.discount ? `  -${it.discount.toFixed(2)}` : ''}`,
        w - 9
      ) + it.line_total.toFixed(2)
    )
  }
  lines.push(''.padEnd(w, '-'))
  const row = (label, val) => lines.push(padRight(label, w - 9) + val.toFixed(2))
  row('Subtotal', txn.subtotal)
  if (txn.discount) row('Discount', -txn.discount)
  if (txn.tax) row('Tax', txn.tax)
  row('TOTAL', txn.total)
  lines.push(''.padEnd(w, '-'))
  lines.push(`Payment:   ${txn.payment_method.toUpperCase()}${txn.payment_method === 'split' ? ` (card ${txn.card_amount.toFixed(2)})` : ''}`)
  if (txn.amount_tendered > 0) lines.push(`Tendered:  ${txn.amount_tendered.toFixed(2)}`)
  if (txn.change_due > 0) lines.push(`Change:    ${txn.change_due.toFixed(2)}`)
  lines.push('')
  lines.push(center('Thank you for your business!'))
  lines.push('')

  return lines.join('\n')
}

export function renderHtmlReceipt(txn, items, store = {}) {
  const storeName = store.store_name || 'DM LUBRICANTS'
  const storeAddress = store.address || 'Shop # 12 Malir Karachi'
  const storePhone = store.phone || '03450204675'
  const storeEmail = store.email || 'info@Dmlubricant.com'
  const storeWhatsapp = '03450204675'
  const taxRate = txn.tax_rate || 0

  const itemsHtml = items.map((it, idx) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 6px 0; text-align: left;">${idx + 1}</td>
      <td style="padding: 6px 0; text-align: left;">
        <div style="font-weight: 600; color: #1e293b;">${it.product_name}</div>
        <div style="font-size: 11px; color: #64748b;">${it.sku || ''}</div>
      </td>
      <td style="padding: 6px 0; text-align: center; color: #334155;">${Math.abs(it.quantity)}</td>
      <td style="padding: 6px 0; text-align: right; color: #334155;">${it.unit_price.toFixed(2)}</td>
      <td style="padding: 6px 0; text-align: right; color: #16a34a; font-size: 11px;">${it.discount && it.discount > 0 ? '-' + it.discount.toFixed(2) : '-'}</td>
      <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">${it.line_total.toFixed(2)}</td>
    </tr>
  `).join('')

  const isCredit = txn.payment_method === 'credit'
  const custName = txn.customer ? txn.customer.name : 'Walk-in Guest'
  const custPhone = txn.customer?.phone || ''
  const custEmail = txn.customer?.email || ''
  
  let customerDetailsHtml = ''
  if (txn.customer) {
    customerDetailsHtml = `
      <div style="margin-top: 15px; padding: 10px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
        <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</div>
        <div><strong>Name:</strong> ${custName}</div>
        ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
        ${custEmail ? `<div><strong>Email:</strong> ${custEmail}</div>` : ''}
        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #cbd5e1; font-weight: bold; color: ${isCredit ? '#ef4444' : '#475569'};">
          Outstanding Debt: PKR ${(txn.customer.balance || 0).toFixed(2)}
        </div>
      </div>
    `
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${txn.receipt_number}</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; background: #fff; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-card { box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 13px;
            color: #334155;
            background: #f1f5f9;
            margin: 0;
            padding: 20px;
          }
          .receipt-card {
            background: #fff;
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          <!-- LETTERHEAD -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
              <!-- Left: Logo & Company Name -->
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="/logo.png" alt="DM POS Logo" style="height: 52px; object-fit: contain; flex-shrink: 0;" />
                <div style="text-align: left;">
                  <div style="font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1.1; letter-spacing: -0.5px;">${storeName}</div>
                  <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Premium Lubricants</div>
                </div>
              </div>
              
              <!-- Right: Contact Details -->
              <div style="text-align: right; font-size: 10px; color: #475569; line-height: 1.45; font-weight: 500;">
                <div>${storeAddress}</div>
                <div>Call: ${storePhone}</div>
                <div>WhatsApp: ${storeWhatsapp}</div>
                <div>Email: ${storeEmail}</div>
              </div>
            </div>
            
            <!-- Red/Black Split Accent Line -->
            <div style="margin-top: 15px; height: 3px; background: linear-gradient(to right, #ef4444 35%, #0f172a 35%);"></div>
            
            <div style="margin-top: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #475569; text-align: center;">
              Sales Receipt / Bill
            </div>
          </div>

          <!-- META DETAILS -->
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569; margin-bottom: 15px;">
            <tr>
              <td style="padding: 2px 0;"><strong>Receipt:</strong> ${txn.receipt_number}</td>
              <td style="padding: 2px 0; text-align: right;"><strong>Date:</strong> ${fmtDateTime(txn.created_at)}</td>
            </tr>
          </table>

          <!-- CUSTOMER DETAILS -->
          ${customerDetailsHtml}

          <!-- ITEMS TABLE -->
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px;">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 10px;">
                <th style="padding: 6px 0; text-align: left; width: 20px;">#</th>
                <th style="padding: 6px 0; text-align: left;">Item Description</th>
                <th style="padding: 6px 0; text-align: center; width: 30px;">Qty</th>
                <th style="padding: 6px 0; text-align: right; width: 50px;">Price</th>
                <th style="padding: 6px 0; text-align: right; width: 40px;">Disc</th>
                <th style="padding: 6px 0; text-align: right; width: 60px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- SUMMARY SECTION -->
          <div style="margin-top: 15px; border-top: 2px solid #e2e8f0; padding-top: 10px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569;">
              <tr>
                <td style="padding: 3px 0; text-align: left;">Subtotal</td>
                <td style="padding: 3px 0; text-align: right;">PKR ${txn.subtotal.toFixed(2)}</td>
              </tr>
              ${txn.discount ? `
              <tr>
                <td style="padding: 3px 0; text-align: left; color: #16a34a;">Discount</td>
                <td style="padding: 3px 0; text-align: right; color: #16a34a;">-PKR ${txn.discount.toFixed(2)}</td>
              </tr>
              ` : ''}
              ${txn.tax ? `
              <tr>
                <td style="padding: 3px 0; text-align: left;">Tax (${(taxRate * 100).toFixed(0)}%)</td>
                <td style="padding: 3px 0; text-align: right;">PKR ${txn.tax.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr style="font-size: 15px; font-weight: bold; color: #0f172a;">
                <td style="padding: 8px 0 3px 0; text-align: left; border-top: 1px solid #cbd5e1;">Grand Total</td>
                <td style="padding: 8px 0 3px 0; text-align: right; border-top: 1px solid #cbd5e1;">PKR ${txn.total.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <!-- PAYMENT DETAILS SUMMARY -->
          <div style="margin-top: 12px; padding: 10px; background-color: #f8fafc; border-radius: 8px; font-size: 12px; color: #475569; border: 1px solid #f1f5f9;">
            ${isCredit ? `
              <div style="display: flex; justify-content: space-between; font-weight: bold; color: #b91c1c;">
                <span>Total Charged to Credit:</span>
                <span>PKR ${txn.total.toFixed(2)}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between;">
                <span>Amount Tendered:</span>
                <span style="font-weight: 600; color: #1e293b;">PKR ${(txn.amount_tendered || 0).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 3px;">
                <span>Change Due:</span>
                <span style="font-weight: bold; color: #15803d;">PKR ${(txn.change_due || 0).toFixed(2)}</span>
              </div>
            `}
          </div>

          <!-- FOOTER -->
          <div style="text-align: center; margin-top: 35px; border-top: 1px dashed #e2e8f0; padding-top: 15px; margin-bottom: 15px;">
            <div style="font-size: 12px; font-weight: 700; color: #334155;">Thank you for your business!</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Powered by DM POS</div>
          </div>
          <!-- Red/Black Split Accent Footer Band mimicking reference design -->
          <div style="height: 10px; background: linear-gradient(to right, #ef4444 35%, #0f172a 35%); margin-left: -24px; margin-right: -24px; margin-bottom: -24px; border-radius: 0 0 12px 12px; margin-top: 25px;"></div>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 250);
          }
        </script>
      </body>
    </html>
  `
}

export function printReceipt(txn, items, store) {
  const html = renderHtmlReceipt(txn, items, store)
  const win = window.open('', '_blank', 'width=850,height=900')
  if (!win) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 500)
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
}

export function emailReceipt(txn, items, store) {
  const text = renderReceipt(txn, items, store)
  const subject = encodeURIComponent(`Receipt ${txn.receipt_number}`)
  const body = encodeURIComponent(text)
  window.open(`mailto:${txn.customer?.email || ''}?subject=${subject}&body=${body}`)
}

export function useReceiptStore() {
  // Reads store settings from localStorage (set in Settings page)
  const raw = typeof window !== 'undefined' ? window.localStorage.getItem('pos_store_settings') : null
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function renderHtmlLedger(customer, ledgerItems, store = {}) {
  const storeName = store.store_name || 'DM LUBRICANTS'
  const storeAddress = store.address || 'Shop # 12 Malir Karachi'
  const storePhone = store.phone || '03450204675'
  const storeWhatsapp = store.whatsapp || '03450204675'
  const storeEmail = store.email || 'info@Dmlubricant.com'

  const ledgerRows = ledgerItems.map((item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
      <td style="padding: 8px 6px; text-align: left; color: #475569;">${fmtDateTime(item.created_at)}</td>
      <td style="padding: 8px 6px; text-align: left; color: #1e293b; font-weight: 500;">${item.description}</td>
      <td style="padding: 8px 6px; text-align: right; color: #b91c1c; font-weight: 600;">${item.debit > 0 ? 'PKR ' + item.debit.toFixed(2) : '-'}</td>
      <td style="padding: 8px 6px; text-align: right; color: #16a34a; font-weight: 600;">${item.credit > 0 ? 'PKR ' + item.credit.toFixed(2) : '-'}</td>
      <td style="padding: 8px 6px; text-align: right; color: #0f172a; font-weight: bold;">PKR ${item.balance.toFixed(2)}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto 30px auto; padding: 24px; color: #334155; page-break-after: always; min-height: 100vh; box-sizing: border-box; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
      <!-- Letterhead Header mimicking reference design -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="text-align: left; vertical-align: middle; width: 50%;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="/logo.png" style="height: 60px; display: inline-block; vertical-align: middle;" />
              <div style="display: inline-block; vertical-align: middle; margin-left: 10px;">
                <div style="font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1.1; letter-spacing: -0.5px;">${storeName}</div>
                <div style="font-size: 11px; color: #ef4444; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px;">Retail Point of Sale</div>
              </div>
            </div>
          </td>
          <td style="text-align: right; vertical-align: middle; font-size: 11px; color: #475569; line-height: 1.4; width: 50%;">
            <div>${storeAddress}</div>
            <div>Call: ${storePhone}</div>
            <div>WhatsApp: ${storeWhatsapp}</div>
            <div>Email: ${storeEmail}</div>
          </td>
        </tr>
      </table>

      <!-- Red/Black Split Accent Divider -->
      <div style="height: 4px; background: linear-gradient(to right, #ef4444 35%, #0f172a 35%); margin-bottom: 20px;"></div>

      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Customer Udhaar Ledger Statement</h2>
        <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Generated on ${fmtDateTime(new Date())}</p>
      </div>

      <!-- Customer Summary -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 12px; font-size: 12px; line-height: 1.5; width: 60%;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">Account Holder</div>
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;">${customer.name}</div>
            ${customer.phone ? `<div><strong>Phone:</strong> ${customer.phone}</div>` : ''}
            ${customer.email ? `<div><strong>Email:</strong> ${customer.email}</div>` : ''}
          </td>
          <td style="padding: 12px; text-align: right; font-size: 12px; line-height: 1.5; width: 40%; border-left: 1px dashed #cbd5e1;">
            <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: bold; margin-bottom: 4px;">Total Outstanding Balance</div>
            <div style="font-size: 20px; font-weight: 900; color: #b91c1c;">PKR ${(customer.balance || 0).toFixed(2)}</div>
            <div style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px;">Please clear dues as soon as possible.</div>
          </td>
        </tr>
      </table>

      <!-- Ledger Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px 6px; text-align: left;">Date & Time</th>
            <th style="padding: 8px 6px; text-align: left;">Description / Ref</th>
            <th style="padding: 8px 6px; text-align: right; width: 120px;">Debit (Udhaar)</th>
            <th style="padding: 8px 6px; text-align: right; width: 120px;">Credit (Paid)</th>
            <th style="padding: 8px 6px; text-align: right; width: 140px;">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRows || '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #94a3b8;">No ledger transactions recorded yet.</td></tr>'}
        </tbody>
      </table>

      <!-- Footer message -->
      <div style="text-align: center; margin-top: auto; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 10px; color: #94a3b8;">
        <div>Thank you for your business! DM Lubricants - Shop # 12 Malir Karachi</div>
      </div>
    </div>
  `
}

export function printLedgerStatements(dataArray, store) {
  const htmlContent = dataArray.map(item => renderHtmlLedger(item.customer, item.ledgerItems, store)).join('')
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Customer Ledger Statements</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; background: #fff; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none; }
            div[style*="max-width: 800px"] { max-width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          }
          body {
            background-color: #f1f5f9;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 250);
          }
        </script>
      </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=850,height=900')
  if (!win) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(fullHtml)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 500)
    return
  }
  win.document.open()
  win.document.write(fullHtml)
  win.document.close()
}

export function printReceipts(txnDataArray, store) {
  const cardsHtml = txnDataArray.map(item => {
    const storeName = store.store_name || 'DM LUBRICANTS'
    const storeAddress = store.address || 'Shop # 12 Malir Karachi'
    const storePhone = store.phone || '03450204675'
    const storeWhatsapp = store.whatsapp || '03450204675'
    const storeEmail = store.email || 'info@Dmlubricant.com'

    const txn = item.txn
    const items = item.items
    const taxRate = txn.tax_rate || 0
    const isCredit = txn.payment_method === 'credit'
    
    const itemsHtml = items.map((it, idx) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; text-align: left;">${idx + 1}</td>
        <td style="padding: 6px 0; text-align: left;">
          <div style="font-weight: 600; color: #1e293b;">${it.product_name}</div>
          <div style="font-size: 11px; color: #64748b;">${it.sku}</div>
        </td>
        <td style="padding: 6px 0; text-align: center; color: #334155;">${Math.abs(it.quantity)}</td>
        <td style="padding: 6px 0; text-align: right; color: #334155;">PKR ${it.unit_price.toFixed(2)}</td>
        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1e293b;">PKR ${it.line_total.toFixed(2)}</td>
      </tr>
    `).join('')

    const custName = txn.customer ? txn.customer.name : 'Walk-in Guest'
    const custPhone = txn.customer?.phone || ''
    const custEmail = txn.customer?.email || ''
    
    let customerDetailsHtml = ''
    if (txn.customer) {
      customerDetailsHtml = `
        <div style="margin-top: 15px; padding: 10px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
          <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</div>
          <div><strong>Name:</strong> ${custName}</div>
          ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
          ${custEmail ? `<div><strong>Email:</strong> ${custEmail}</div>` : ''}
          <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #cbd5e1; font-weight: bold; color: ${isCredit ? '#ef4444' : '#475569'};">
            Outstanding Debt: PKR ${(txn.customer.balance || 0).toFixed(2)}
          </div>
        </div>
      `
    }

    return `
      <div class="receipt-card" style="page-break-after: always; margin-bottom: 40px; background: #fff; max-width: 800px; margin-left: auto; margin-right: auto; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); box-sizing: border-box;">
        <!-- LETTERHEAD -->
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="/logo.png" alt="DM POS Logo" style="height: 52px; object-fit: contain; flex-shrink: 0;" />
              <div style="text-align: left;">
                <div style="font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1.1; letter-spacing: -0.5px;">${storeName}</div>
                <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Premium Lubricants</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #475569; line-height: 1.45; font-weight: 500;">
              <div>${storeAddress}</div>
              <div>Call: ${storePhone}</div>
              <div>WhatsApp: ${storeWhatsapp}</div>
              <div>Email: ${storeEmail}</div>
            </div>
          </div>
          <div style="margin-top: 15px; height: 3px; background: linear-gradient(to right, #ef4444 35%, #0f172a 35%);"></div>
          <div style="margin-top: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #475569; text-align: center;">
            Sales Receipt / Bill
          </div>
        </div>

        <!-- META DETAILS -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569; margin-bottom: 15px;">
          <tr>
            <td style="padding: 2px 0;"><strong>Receipt:</strong> ${txn.receipt_number}</td>
            <td style="padding: 2px 0; text-align: right;"><strong>Date:</strong> ${fmtDateTime(txn.created_at)}</td>
          </tr>
        </table>

        <!-- CUSTOMER DETAILS -->
        ${customerDetailsHtml}

        <!-- ITEMS TABLE -->
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 10px;">
              <th style="padding: 6px 0; text-align: left; width: 20px;">#</th>
              <th style="padding: 6px 0; text-align: left;">Item Description</th>
              <th style="padding: 6px 0; text-align: center; width: 30px;">Qty</th>
              <th style="padding: 6px 0; text-align: right; width: 50px;">Price</th>
              <th style="padding: 6px 0; text-align: right; width: 60px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- SUMMARY SECTION -->
        <div style="margin-top: 15px; border-top: 2px solid #e2e8f0; padding-top: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569;">
            <tr>
              <td style="padding: 3px 0; text-align: left;">Subtotal</td>
              <td style="padding: 3px 0; text-align: right;">PKR ${txn.subtotal.toFixed(2)}</td>
            </tr>
            ${txn.discount ? `
            <tr>
              <td style="padding: 3px 0; text-align: left; color: #16a34a;">Discount</td>
              <td style="padding: 3px 0; text-align: right; color: #16a34a;">-PKR ${txn.discount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${txn.tax ? `
            <tr>
              <td style="padding: 3px 0; text-align: left;">Tax (${(taxRate * 100).toFixed(0)}%)</td>
              <td style="padding: 3px 0; text-align: right;">PKR ${txn.tax.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr style="font-size: 15px; font-weight: bold; color: #0f172a;">
              <td style="padding: 8px 0 3px 0; text-align: left; border-top: 1px solid #cbd5e1;">Grand Total</td>
              <td style="padding: 8px 0 3px 0; text-align: right; border-top: 1px solid #cbd5e1;">PKR ${txn.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- PAYMENT DETAILS SUMMARY -->
        <div style="margin-top: 12px; padding: 10px; background-color: #f8fafc; border-radius: 8px; font-size: 12px; color: #475569; border: 1px solid #f1f5f9;">
          ${isCredit ? `
            <div style="display: flex; justify-content: space-between; font-weight: bold; color: #b91c1c;">
              <span>Total Charged to Credit:</span>
              <span>PKR ${txn.total.toFixed(2)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between;">
              <span>Amount Tendered:</span>
              <span style="font-weight: 600; color: #1e293b;">PKR ${(txn.amount_tendered || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 3px;">
              <span>Change Due:</span>
              <span style="font-weight: bold; color: #15803d;">PKR ${(txn.change_due || 0).toFixed(2)}</span>
            </div>
          `}
        </div>

        <!-- FOOTER -->
        <div style="text-align: center; margin-top: 35px; border-top: 1px dashed #e2e8f0; padding-top: 15px; margin-bottom: 15px;">
          <div style="font-size: 12px; font-weight: 700; color: #334155;">Thank you for your business!</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Powered by DM POS</div>
        </div>
        <!-- Red/Black Split Accent Footer Band -->
        <div style="height: 10px; background: linear-gradient(to right, #ef4444 35%, #0f172a 35%); margin-left: -24px; margin-right: -24px; margin-bottom: -24px; border-radius: 0 0 12px 12px; margin-top: 25px;"></div>
      </div>
    `
  }).join('')

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Bulk Receipts</title>
        <meta charset="utf-8" />
        <style>
          @media print {
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; background: #fff; width: 100%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .receipt-card { box-shadow: none !important; border: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none; }
          }
          body {
            background-color: #f1f5f9;
            margin: 0;
            padding: 20px;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}
        <script>
          window.onload = () => {
            setTimeout(() => { window.print(); }, 250);
          }
        </script>
      </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=850,height=900')
  if (!win) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(fullHtml)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 500)
    return
  }
  win.document.open()
  win.document.write(fullHtml)
  win.document.close()
}
