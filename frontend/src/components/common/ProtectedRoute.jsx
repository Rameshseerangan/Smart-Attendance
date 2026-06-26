import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Wraps routes that require authentication. Optionally restrict to specific
 * roles via `allow={['admin']}` — faculty hitting an admin-only route gets
 * redirected rather than seeing a 403 from the API after the page loads.
 */
export default function ProtectedRoute({ children, allow }) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
