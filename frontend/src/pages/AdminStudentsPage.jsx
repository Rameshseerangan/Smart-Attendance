import { useEffect, useRef, useState } from 'react'
import { Plus, ScanFace, Search, X, CheckCircle, AlertCircle, Upload, Trash2 } from 'lucide-react'
import Card from '../components/common/Card'
import StatusBadge from '../components/common/StatusBadge'
import {
  listStudents,
  createStudent,
  enrollStudentFace,
} from '../services/studentService'

const EMPTY_FORM = {
  register_no: '',
  name: '',
  department: '',
  year: 1,
  section: '',
  email: '',
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminStudentsPage() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    try {
      const data = await listStudents(search ? { search } : {})
      setStudents(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Students</h1>
          <p className="text-slate-500 text-sm mt-1">Manage student records and face enrollment.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Student
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchStudents()}
          placeholder="Search by name or register no…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
        />
      </div>

      {/* Table */}
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Register No.</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Dept / Year / Section</th>
                <th className="px-5 py-3 font-medium">Face Enrollment</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No students found.</td></tr>
              ) : students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-ink-900">{s.register_no}</td>
                  <td className="px-5 py-3 text-ink-900">{s.name}</td>
                  <td className="px-5 py-3 text-slate-600">{s.department} / Y{s.year} / {s.section}</td>
                  <td className="px-5 py-3">
                    {s.face_enrolled
                      ? <StatusBadge variant="present">{s.enrolled_face_count} photo(s)</StatusBadge>
                      : <StatusBadge variant="warn">Not enrolled</StatusBadge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEnrollTarget(s)}
                      className="flex items-center gap-1.5 text-accent hover:text-accent-dim text-sm font-medium ml-auto"
                    >
                      <ScanFace size={15} /> Enroll Face
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Student Modal (with inline face upload) */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onDone={() => { setShowAddModal(false); fetchStudents() }}
        />
      )}

      {/* Enroll Face Modal (for existing students) */}
      {enrollTarget && (
        <EnrollFaceModal
          student={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onDone={fetchStudents}
        />
      )}
    </div>
  )
}

// ─── Add Student Modal (Details + Photos in one flow) ────────────────────────
function AddStudentModal({ onClose, onDone }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [photos, setPhotos] = useState([])        // File[]
  const [previews, setPreviews] = useState([])    // object URL[]
  const [step, setStep] = useState('form')        // 'form' | 'enrolling' | 'done'
  const [error, setError] = useState('')
  const [enrollResult, setEnrollResult] = useState(null)
  const fileInputRef = useRef()

  function handlePhotoChange(e) {
    const selected = Array.from(e.target.files)
    const merged = [...photos, ...selected].slice(0, 10)   // cap at 10
    setPhotos(merged)
    setPreviews(merged.map((f) => URL.createObjectURL(f)))
  }

  function removePhoto(index) {
    const next = photos.filter((_, i) => i !== index)
    setPhotos(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // Step 1 — create student record
    let created
    try {
      created = await createStudent({ ...form, year: Number(form.year) })
    } catch (err) {
      setError(err.message || 'Failed to create student.')
      return
    }

    // Step 2 — enroll face if photos were selected
    if (photos.length > 0) {
      setStep('enrolling')
      try {
        const res = await enrollStudentFace(created.id, photos)
        setEnrollResult(res)
      } catch {
        setEnrollResult({ message: 'Student created but face enrollment failed.', rejection_reasons: [] })
      }
      setStep('done')
    } else {
      // No photos — just finish
      onDone()
    }
  }

  // Done screen
  if (step === 'done') {
    return (
      <Modal title="Student Added" onClose={onDone}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle size={20} className="text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-ink-900">{form.name} has been added.</p>
              {enrollResult && (
                <p className="text-xs text-slate-500 mt-0.5">{enrollResult.message}</p>
              )}
            </div>
          </div>
          {enrollResult?.rejection_reasons?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Some photos were rejected:</p>
              <ul className="space-y-0.5">
                {enrollResult.rejection_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-amber-600">• {r}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={onDone}
            className="w-full bg-accent hover:bg-accent-dim text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </Modal>
    )
  }

  // Enrolling screen
  if (step === 'enrolling') {
    return (
      <Modal title="Processing…" onClose={() => {}}>
        <div className="py-8 flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Enrolling face photos…</p>
        </div>
      </Modal>
    )
  }

  // Main form
  return (
    <Modal title="Add Student" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Student Details ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Student Details</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Register No." value={form.register_no} onChange={(v) => setForm({ ...form, register_no: v })} required />
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required />
            <Field label="Year" type="number" min={1} max={5} value={form.year} onChange={(v) => setForm({ ...form, year: v })} required />
            <Field label="Section" value={form.section} onChange={(v) => setForm({ ...form, section: v })} required />
            <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
        </div>

        {/* ── Face Photos ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Face Photos <span className="normal-case font-normal text-slate-400">(optional — 3–5 recommended)</span>
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Upload clear, front-facing photos now, or enroll later from the student table.
          </p>

          {/* Photo Previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-5 gap-2 mb-3">
              {previews.map((src, i) => (
                <div key={i} className="relative group aspect-square">
                  <img
                    src={src}
                    alt={`photo-${i}`}
                    className="w-full h-full object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 shadow text-slate-400 hover:text-absent opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-dashed border-slate-300 hover:border-accent text-slate-500 hover:text-accent text-sm px-4 py-2.5 rounded-lg w-full justify-center transition-colors"
          >
            <Upload size={15} />
            {photos.length === 0 ? 'Select photos…' : `${photos.length} selected — add more`}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-absent bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-accent hover:bg-accent-dim text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
        >
          {photos.length > 0 ? 'Add Student & Enroll Face' : 'Add Student'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Enroll Face Modal (for existing students from table) ────────────────────
function EnrollFaceModal({ student, onClose, onDone }) {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef()

  function handleChange(e) {
    const selected = Array.from(e.target.files)
    const merged = [...files, ...selected].slice(0, 10)
    setFiles(merged)
    setPreviews(merged.map((f) => URL.createObjectURL(f)))
  }

  function removePhoto(index) {
    const next = files.filter((_, i) => i !== index)
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (files.length === 0) return
    setSubmitting(true)
    try {
      const res = await enrollStudentFace(student.id, files)
      setResult(res)
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Enroll Face — ${student.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Upload 3–5 clear, front-facing photos for best recognition accuracy.
        </p>

        {previews.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative group aspect-square">
                <img src={src} alt={`p-${i}`} className="w-full h-full object-cover rounded-lg border border-slate-200" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 shadow text-slate-400 hover:text-absent opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-slate-300 hover:border-accent text-slate-500 hover:text-accent text-sm px-4 py-2.5 rounded-lg w-full justify-center transition-colors"
        >
          <Upload size={15} />
          {files.length === 0 ? 'Select photos…' : `${files.length} selected — add more`}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />

        {result && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <p className="text-ink-900 font-medium">{result.message}</p>
            {result.rejection_reasons?.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-absent text-xs">
                {result.rejection_reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || files.length === 0}
          className="w-full bg-accent hover:bg-accent-dim disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
        >
          {submitting ? 'Enrolling…' : 'Enroll Photos'}
        </button>
      </form>
    </Modal>
  )
}

// ─── Shared Components ───────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', required, min, max }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
      />
    </div>
  )
}

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 px-4">
      <div className={`bg-white rounded-xl shadow-elevated w-full p-6 ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}