import apiClient from './apiClient'

export async function listSubjects() {
  const { data } = await apiClient.get('/subjects')
  return data
}

export async function createSubject(payload) {
  const { data } = await apiClient.post('/subjects', payload)
  return data
}

export async function deleteSubject(subjectId) {
  await apiClient.delete(`/subjects/${subjectId}`)
}
