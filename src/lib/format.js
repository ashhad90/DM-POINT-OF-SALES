export const fmtMoney = (n) => {
  const val = Number(n) || 0
  return 'PKR ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const fmtNumber = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0)

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export const todayISO = () => new Date().toISOString().slice(0, 10)
