/**
 * Centralized API client. Every service module imports this rather than
 * creating its own axios instance — keeps auth header injection, error
 * normalization, and base URL configuration in one place.
 */
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// Attach JWT to every outgoing request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sa_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Recursively ensures every plain object in the response has an `id` field,
 * copying it from `_id` when `id` is absent. This guards the whole frontend
 * against backend responses that serialize Mongo documents with `_id`
 * instead of the aliased `id` (e.g. a running server using a build where
 * response_model aliasing isn't applied) — every page can then safely use
 * `.id` without each one needing its own `s.id || s._id` fallback.
 */
function normalizeIds(data) {
  if (Array.isArray(data)) {
    return data.map(normalizeIds)
  }
  if (data && typeof data === 'object') {
    const normalized = { ...data }
    if (normalized.id === undefined && normalized._id !== undefined) {
      normalized.id = normalized._id
    }
    for (const key of Object.keys(normalized)) {
      if (normalized[key] && typeof normalized[key] === 'object') {
        normalized[key] = normalizeIds(normalized[key])
      }
    }
    return normalized
  }
  return data
}

apiClient.interceptors.response.use(
  (response) => {
    response.data = normalizeIds(response.data)
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sa_token')
      localStorage.removeItem('sa_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const message =
      error.response?.data?.detail || error.message || 'An unexpected error occurred'
    return Promise.reject(new Error(typeof message === 'string' ? message : JSON.stringify(message)))
  }
)

export default apiClient