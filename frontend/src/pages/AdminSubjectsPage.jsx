import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import Card from '../components/common/Card'
import { listSubjects, createSubject } from '../services/subjectService'
import { listFaculty } from '../services/facultyService'

const EMPTY_FORM = { subject_code: '', subject_name: '', department: '', year: 1, section: '', faculty_id: '' }

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubjects()
    listFaculty().then(setFacultyList)
  }, [])

  async function fetchSubjects() {
    setLoading(true)
    try {
      setSubjects(await listSubjects())
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      await createSubject({ ...form, year: Number(form.year) })
      setForm(EMPTY_FORM)
      setShowForm(false)
      fetchSubjects()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Subjects</h1>
          <p className="text-slate-500 text-sm mt-1">Manage courses and subject-faculty assignment.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Subject
        </button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Dept / Year / Section</th>
                <th className="px-5 py-3 font-medium">Faculty</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : subjects.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No subjects found.</td></tr>
              ) : (
                subjects.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-ink-900">{s.subject_code}</td>
                    <td className="px-5 py-3 text-ink-900">{s.subject_name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {s.department} / Y{s.year} / {s.section}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.faculty_name || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <div className="fixed inset-0 bg-ink-900/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-elevated max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-ink-900">Add Subject</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subject Code" value={form.subject_code} onChange={(v) => setForm({ ...form, subject_code: v })} required />
                <Field label="Subject Name" value={form.subject_name} onChange={(v) => setForm({ ...form, subject_name: v })} required />
                <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required />
                <Field label="Year" type="number" min={1} max={5} value={form.year} onChange={(v) => setForm({ ...form, year: v })} required />
                <Field label="Section" value={form.section} onChange={(v) => setForm({ ...form, section: v })} required />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Faculty</label>
                  <select
                    value={form.faculty_id}
                    onChange={(e) => setForm({ ...form, faculty_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
                  >
                    <option value="">Select…</option>
                    {facultyList.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-absent">{error}</p>}
              <button type="submit" className="w-full bg-accent hover:bg-accent-dim text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2">
                Add Subject
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

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
