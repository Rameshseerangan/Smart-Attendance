import apiClient from './apiClient'

export async function getAbsenteeList(subjectId, date) {
  const { data } = await apiClient.get('/reports/absentees', {
    params: { subject_id: subjectId, date },
  })
  return data
}

export async function getDefaulterList(filters = {}) {
  const { data } = await apiClient.get('/reports/defaulters', { params: filters })
  return data
}

export async function getSubjectSummary(subjectId, date) {
  const { data } = await apiClient.get('/reports/subject-summary', {
    params: { subject_id: subjectId, date },
  })
  return data
}
