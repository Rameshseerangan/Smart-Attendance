import { useEffect, useState } from 'react'
import Card from '../components/common/Card'
import StatusBadge from '../components/common/StatusBadge'
import { listSubjects } from '../services/subjectService'
import { getAttendanceRecords } from '../services/attendanceService'

export default function AttendanceRecordsPage() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listSubjects().then(setSubjects)
  }, [])

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, date])

  async function fetchRecords() {
    setLoading(true)
    try {
      const filters = {}
      if (subjectId) filters.subject_id = subjectId
      if (date) filters.date = date
      const data = await getAttendanceRecords(filters)
      setRecords(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Attendance Records</h1>
        <p className="text-slate-500 text-sm mt-1">View and filter historical attendance.</p>
      </div>

      <Card className="mb-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_code} — {s.subject_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
            />
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Register No.</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Confidence</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No attendance records found for the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-ink-900">{r.register_no}</td>
                    <td className="px-5 py-3 text-ink-900">{r.student_name}</td>
                    <td className="px-5 py-3 text-slate-600">{r.subject_code}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{r.date}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{r.time}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">
                      {r.confidence ? `${Math.round(r.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge variant={r.status === 'Present' ? 'present' : 'absent'}>
                        {r.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
