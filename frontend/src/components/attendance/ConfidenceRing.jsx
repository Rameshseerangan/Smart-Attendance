/**
 * The signature visual element of this product: a confidence ring around a
 * student's initials, filling proportionally to the face-match similarity
 * score. This is what the recognition feed renders for each student detected
 * during a live attendance-processing job — it makes the otherwise invisible
 * "the model is X% confident this is Roll No. 21CS045" concrete and legible
 * to a non-technical faculty member glancing at the screen.
 */
const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ringColor(score, isLive) {
  if (!isLive) return '#DC2626' // spoof flagged — red regardless of match score
  if (score >= 0.7) return '#16A34A' // high confidence — green
  if (score >= 0.55) return '#2563EB' // acceptable match — blue
  return '#D97706' // borderline — amber
}

export default function ConfidenceRing({ name, score, isLive = true, size = 64 }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(score, 1))
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="#E2E8F0" strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke={ringColor(score, isLive)}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-ink-900">{initials}</span>
        </div>
      </div>
      <span className="text-[11px] font-mono text-slate-500">
        {isLive ? `${Math.round(score * 100)}%` : 'spoof'}
      </span>
    </div>
  )
}
