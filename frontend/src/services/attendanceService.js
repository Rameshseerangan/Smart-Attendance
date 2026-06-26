import apiClient from './apiClient'

export async function uploadAttendanceSession(subjectId, date, file, onUploadProgress) {
  const formData = new FormData()
  formData.append('file', file)

  const params = new URLSearchParams({ subject_id: subjectId })
  if (date) params.append('date', date)

  const { data } = await apiClient.post(
    `/attendance/sessions/upload?${params.toString()}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }
  )
  return data
}

export async function getJobStatus(jobId) {
  const { data } = await apiClient.get(`/attendance/jobs/${jobId}`)
  return data
}

export async function getAttendanceRecords(filters = {}) {
  const { data } = await apiClient.get('/attendance/records', { params: filters })
  return data
}

/**
 * Polls a job until it reaches a terminal state (completed/failed).
 * onUpdate is called on every poll tick with the latest status payload.
 * Returns the final status payload.
 */
export async function pollJobUntilDone(jobId, onUpdate, intervalMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const status = await getJobStatus(jobId)
        onUpdate?.(status)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(timer)
          resolve(status)
        }
      } catch (err) {
        clearInterval(timer)
        reject(err)
      }
    }, intervalMs)
  })
}
