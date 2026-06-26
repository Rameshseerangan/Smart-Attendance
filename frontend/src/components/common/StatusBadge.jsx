const VARIANTS = {
  present: 'bg-emerald-50 text-present border-emerald-200',
  absent: 'bg-red-50 text-absent border-red-200',
  warn: 'bg-amber-50 text-warn border-amber-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  info: 'bg-blue-50 text-accent border-blue-200',
}

export default function StatusBadge({ variant = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  )
}
