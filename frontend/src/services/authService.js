import apiClient from './apiClient'

export async function login(email, password) {
  const { data } = await apiClient.post('/auth/login', { email, password })
  localStorage.setItem('sa_token', data.access_token)
  localStorage.setItem(
    'sa_user',
    JSON.stringify({ id: data.user_id, name: data.name, role: data.role })
  )
  return data
}

export function logout() {
  localStorage.removeItem('sa_token')
  localStorage.removeItem('sa_user')
}

export function getCurrentUser() {
  const raw = localStorage.getItem('sa_user')
  return raw ? JSON.parse(raw) : null
}

export function isAuthenticated() {
  return !!localStorage.getItem('sa_token')
}
