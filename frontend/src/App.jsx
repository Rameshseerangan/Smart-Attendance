import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout from './layouts/AppLayout'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TakeAttendancePage from './pages/TakeAttendancePage'
import AttendanceRecordsPage from './pages/AttendanceRecordsPage'
import AdminStudentsPage from './pages/AdminStudentsPage'
import AdminFacultyPage from './pages/AdminFacultyPage'
import AdminSubjectsPage from './pages/AdminSubjectsPage'
import AdminDatabasePage from './pages/AdminDatabasePage'

function withLayout(element) {
  return <AppLayout>{element}</AppLayout>
}

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={<ProtectedRoute>{withLayout(<DashboardPage />)}</ProtectedRoute>}
          />
          <Route
            path="/attendance/take"
            element={<ProtectedRoute>{withLayout(<TakeAttendancePage />)}</ProtectedRoute>}
          />
          <Route
            path="/attendance/records"
            element={<ProtectedRoute>{withLayout(<AttendanceRecordsPage />)}</ProtectedRoute>}
          />

          <Route
            path="/admin/students"
            element={
              <ProtectedRoute allow={['admin']}>{withLayout(<AdminStudentsPage />)}</ProtectedRoute>
            }
          />
          <Route
            path="/admin/faculty"
            element={
              <ProtectedRoute allow={['admin']}>{withLayout(<AdminFacultyPage />)}</ProtectedRoute>
            }
          />
          <Route
            path="/admin/subjects"
            element={
              <ProtectedRoute allow={['admin']}>{withLayout(<AdminSubjectsPage />)}</ProtectedRoute>
            }
          />
          <Route
            path="/admin/database"
            element={
              <ProtectedRoute allow={['admin']}>{withLayout(<AdminDatabasePage />)}</ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
