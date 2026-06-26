import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import Card from '../components/common/Card'
import StatusBadge from '../components/common/StatusBadge'
import { listFaculty, createFaculty } from '../services/facultyService'

const EMPTY_FORM = { name: '', department: '', email: '', password: '' }

export default function AdminFacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFaculty()
  }, [])

  async function fetchFaculty() {
    setLoading(true)
    try {
      setFaculty(await listFaculty())
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    try {
      await createFaculty(form)
      setForm(EMPTY_FORM)
      setShowForm(false)
      fetchFaculty()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Faculty</h1>
          <p className="text-slate-500 text-sm mt-1">Manage faculty accounts.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Faculty
        </button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : faculty.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No faculty found.</td></tr>
              ) : (
                faculty.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-ink-900 font-medium">{f.name}</td>
                    <td className="px-5 py-3 text-slate-600">{f.department}</td>
                    <td className="px-5 py-3 text-slate-600">{f.email}</td>
                    <td className="px-5 py-3">
                      <StatusBadge variant={f.is_active ? 'present' : 'neutral'}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </td>
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
              <h3 className="font-semibold text-ink-900">Add Faculty</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} required />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Field label="Temporary Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} required />
              {error && <p className="text-sm text-absent">{error}</p>}
              <button type="submit" className="w-full bg-accent hover:bg-accent-dim text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-2">
                Add Faculty
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
      />
    </div>
  )
}
