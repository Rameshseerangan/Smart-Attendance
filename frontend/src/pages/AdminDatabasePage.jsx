import { useState } from 'react'
import { Download, Upload, AlertTriangle } from 'lucide-react'
import Card from '../components/common/Card'
import apiClient from '../services/apiClient'

export default function AdminDatabasePage() {
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)
  const [wipeExisting, setWipeExisting] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleBackup() {
    setBackingUp(true)
    try {
      const response = await apiClient.get('/admin/database/backup', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `smart_attendance_backup_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setMessage({ type: 'success', text: 'Backup downloaded successfully.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestore(e) {
    e.preventDefault()
    if (!restoreFile) return
    setRestoring(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('backup_file', restoreFile)
      const { data } = await apiClient.post(
        `/admin/database/restore?wipe_existing=${wipeExisting}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setMessage({ type: 'success', text: `Restored: ${JSON.stringify(data.restored)}` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Backup &amp; Restore</h1>
        <p className="text-slate-500 text-sm mt-1">
          Export or import the full system database (students, faculty, subjects, attendance, face data).
        </p>
      </div>

      <Card className="mb-5">
        <h3 className="font-semibold text-ink-900 mb-2">Backup Database</h3>
        <p className="text-sm text-slate-500 mb-4">
          Downloads a complete JSON snapshot of all records to your device.
        </p>
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="flex items-center gap-2 bg-ink-900 hover:bg-ink-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Download size={16} /> {backingUp ? 'Preparing backup…' : 'Download Backup'}
        </button>
      </Card>

      <Card>
        <h3 className="font-semibold text-ink-900 mb-2">Restore Database</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload a previously downloaded backup file to restore records.
        </p>
        <form onSubmit={handleRestore} className="space-y-4">
          <input
            type="file"
            accept="application/json"
            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
          />

          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={wipeExisting}
              onChange={(e) => setWipeExisting(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong className="text-ink-900">Wipe existing data</strong> before restoring
              (destructive — clears current records first instead of merging).
            </span>
          </label>

          {wipeExisting && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                This will permanently delete all current data before restoring. This cannot be undone.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={restoring || !restoreFile}
            className="flex items-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Upload size={16} /> {restoring ? 'Restoring…' : 'Restore Database'}
          </button>
        </form>
      </Card>

      {message && (
        <p className={`mt-4 text-sm px-3 py-2 rounded-lg ${
          message.type === 'success'
            ? 'bg-emerald-50 text-present border border-emerald-200'
            : 'bg-red-50 text-absent border border-red-200'
        }`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
