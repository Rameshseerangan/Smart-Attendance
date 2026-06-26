export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-card ${
        padded ? 'p-6' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
