import apiClient from './apiClient'

export async function listStudents(filters = {}) {
  const { data } = await apiClient.get('/students', { params: filters })
  return data
}

export async function getStudent(studentId) {
  const { data } = await apiClient.get(`/students/${studentId}`)
  return data
}

export async function createStudent(payload) {
  const { data } = await apiClient.post('/students', payload)
  return data
}

export async function updateStudent(studentId, payload) {
  const { data } = await apiClient.patch(`/students/${studentId}`, payload)
  return data
}

export async function deleteStudent(studentId) {
  await apiClient.delete(`/students/${studentId}`)
}

export async function enrollStudentFace(studentId, files) {
  const formData = new FormData()
  Array.from(files).forEach((file) => formData.append('images', file))
  const { data } = await apiClient.post(`/students/${studentId}/enroll-face`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
