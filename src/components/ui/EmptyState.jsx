export default function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {Icon && (
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon size={28} />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {subtitle && <p className="max-w-xs text-sm text-slate-500">{subtitle}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
