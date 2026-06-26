import apiClient from './apiClient'

export async function listFaculty() {
  const { data } = await apiClient.get('/faculty')
  return data
}

export async function createFaculty(payload) {
  const { data } = await apiClient.post('/faculty', payload)
  return data
}

export async function updateFaculty(facultyId, payload) {
  const { data } = await apiClient.patch(`/faculty/${facultyId}`, payload)
  return data
}

export async function deleteFaculty(facultyId) {
  await apiClient.delete(`/faculty/${facultyId}`)
}
