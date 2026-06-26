import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Users,
  GraduationCap,
  BookOpen,
  FileBarChart,
  DatabaseBackup,
  LogOut,
  ScanFace,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItemBase =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors'
const navItemInactive = 'text-slate-300 hover:bg-ink-800 hover:text-white'
const navItemActive = 'bg-accent text-white shadow-elevated'

function NavItem({ to, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${navItemBase} ${isActive ? navItemActive : navItemInactive}`}
    >
      <Icon size={18} strokeWidth={2} />
      <span>{children}</span>
    </NavLink>
  )
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="min-h-screen flex bg-surface">
      <aside className="w-64 bg-ink-900 flex flex-col shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-6 border-b border-ink-800">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
            <ScanFace size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Smart Attendance</p>
            <p className="text-slate-400 text-xs leading-tight">Proxy Detection System</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard}>
            Dashboard
          </NavItem>
          <NavItem to="/attendance/take" icon={Upload}>
            Take Attendance
          </NavItem>
          <NavItem to="/attendance/records" icon={FileBarChart}>
            Attendance Records
          </NavItem>

          {isAdmin && (
            <>
              <p className="px-3 pt-5 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Admin
              </p>
              <NavItem to="/admin/students" icon={Users}>
                Students
              </NavItem>
              <NavItem to="/admin/faculty" icon={GraduationCap}>
                Faculty
              </NavItem>
              <NavItem to="/admin/subjects" icon={BookOpen}>
                Subjects
              </NavItem>
              <NavItem to="/admin/database" icon={DatabaseBackup}>
                Backup &amp; Restore
              </NavItem>
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-ink-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-ink-700 flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.name}</p>
              <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-ink-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
