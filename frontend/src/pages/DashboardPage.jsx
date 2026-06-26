import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, BookOpen, Upload, FileBarChart, ArrowRight } from 'lucide-react'
import Card from '../components/common/Card'
import { useAuth } from '../context/AuthContext'
import { listStudents } from '../services/studentService'
import { listSubjects } from '../services/subjectService'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ students: 0, subjects: 0 })

  useEffect(() => {
    Promise.all([listStudents().catch(() => []), listSubjects().catch(() => [])]).then(
      ([students, subjects]) => setStats({ students: students.length, subjects: subjects.length })
    )
  }, [])

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here&apos;s a quick overview of your attendance system.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-7">
        <SummaryCard icon={Users} label="Enrolled Students" value={stats.students} />
        <SummaryCard icon={BookOpen} label="Active Subjects" value={stats.subjects} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <QuickAction
          to="/attendance/take"
          icon={Upload}
          title="Take Attendance"
          description="Upload a classroom video or photo to mark attendance automatically."
        />
        <QuickAction
          to="/attendance/records"
          icon={FileBarChart}
          title="View Records"
          description="Browse historical attendance records and generate reports."
        />
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-accent" />
      </div>
      <div>
        <p className="text-2xl font-bold text-ink-900 font-mono leading-none">{value}</p>
        <p className="text-sm text-slate-500 mt-1">{label}</p>
      </div>
    </Card>
  )
}

function QuickAction({ to, icon: Icon, title, description }) {
  return (
    <Link to={to}>
      <Card className="group hover:border-accent transition-colors h-full">
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-lg bg-ink-900 flex items-center justify-center mb-3">
            <Icon size={18} className="text-white" />
          </div>
          <ArrowRight
            size={18}
            className="text-slate-300 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
          />
        </div>
        <h3 className="font-semibold text-ink-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </Card>
    </Link>
  )
}
