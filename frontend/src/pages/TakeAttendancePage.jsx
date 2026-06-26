import { useState, useEffect, useCallback } from 'react'
import { Upload, FileVideo, FileImage, Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import Card from '../components/common/Card'
import StatusBadge from '../components/common/StatusBadge'
import { listSubjects } from '../services/subjectService'
import { uploadAttendanceSession, pollJobUntilDone } from '../services/attendanceService'

export default function TakeAttendancePage() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [jobStatus, setJobStatus] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listSubjects().then(setSubjects).catch((e) => setError(e.message))
  }, [])

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!subjectId || !file) {
      setError('Please select a subject and a classroom video/image file.')
      return
    }
    setError('')
    setUploading(true)
    setJobStatus(null)

    try {
      const job = await uploadAttendanceSession(subjectId, date, file)
      setJobStatus({ status: 'queued', progress_percent: 0, students_recognized: 0, students_flagged_spoof: 0 })
      await pollJobUntilDone(job.job_id, (status) => setJobStatus(status))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const isVideo = file?.type?.startsWith('video')
  const isProcessing = jobStatus && jobStatus.status !== 'completed' && jobStatus.status !== 'failed'

  return (
    <div className="max-w-4xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Take Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a classroom video or photo. Faces are detected, matched against enrolled
          students, and checked for liveness automatically.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              >
                <option value="">Select a subject…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_code} — {s.subject_name} ({s.section})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-900 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1.5">
              Classroom video or photo
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-10 cursor-pointer hover:border-accent hover:bg-blue-50/30 transition-colors">
              <input
                type="file"
                accept="video/*,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <>
                  {isVideo ? (
                    <FileVideo size={28} className="text-accent" />
                  ) : (
                    <FileImage size={28} className="text-accent" />
                  )}
                  <span className="text-sm font-medium text-ink-900">{file.name}</span>
                  <span className="text-xs text-slate-500">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB — click to change
                  </span>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">
                    Click to upload a video or image
                  </span>
                  <span className="text-xs text-slate-400">MP4, AVI, MOV, JPG, PNG</span>
                </>
              )}
            </label>
          </div>

          {error && (
            <p className="text-sm text-absent bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading || isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-60 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
          >
            {uploading && <Loader2 size={16} className="animate-spin" />}
            {uploading ? 'Uploading…' : 'Start Attendance Processing'}
          </button>
        </form>
      </Card>

      {jobStatus && <ProcessingPanel status={jobStatus} />}
    </div>
  )
}

function ProcessingPanel({ status }) {
  const isDone = status.status === 'completed'
  const isFailed = status.status === 'failed'

  return (
    <Card className="mt-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-ink-900">Processing Status</h2>
        {isDone && <StatusBadge variant="present">Completed</StatusBadge>}
        {isFailed && <StatusBadge variant="absent">Failed</StatusBadge>}
        {!isDone && !isFailed && <StatusBadge variant="info">{status.status}</StatusBadge>}
      </div>

      {!isFailed && (
        <div className="mb-5">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Progress</span>
            <span className="font-mono">{status.progress_percent}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${status.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {isFailed ? (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle size={20} className="text-absent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-ink-900">Processing failed</p>
            <p className="text-sm text-slate-600 mt-0.5">{status.error_message}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={CheckCircle2}
            label="Recognized"
            value={status.students_recognized}
            tone="present"
          />
          <StatTile
            icon={ShieldAlert}
            label="Spoof Blocked"
            value={status.students_flagged_spoof}
            tone="absent"
          />
          <StatTile
            icon={Loader2}
            label="Frames Processed"
            value={status.total_frames_processed}
            tone="info"
          />
        </div>
      )}

      {isDone && status.result_summary && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-sm font-medium text-ink-900 mb-2">Session Summary</p>
          <div className="flex gap-6 text-sm">
            <span className="text-slate-600">
              Total: <span className="font-mono font-semibold text-ink-900">{status.result_summary.total_students}</span>
            </span>
            <span className="text-present">
              Present: <span className="font-mono font-semibold">{status.result_summary.present}</span>
            </span>
            <span className="text-absent">
              Absent: <span className="font-mono font-semibold">{status.result_summary.absent}</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

function StatTile({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    present: 'text-present bg-emerald-50',
    absent: 'text-absent bg-red-50',
    info: 'text-accent bg-blue-50',
  }
  return (
    <div className={`rounded-lg p-3.5 ${toneClasses[tone]}`}>
      <Icon size={16} className="mb-2" />
      <p className="text-2xl font-bold font-mono leading-none">{value}</p>
      <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
    </div>
  )
}