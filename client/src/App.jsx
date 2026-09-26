import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { api, clearToken, getToken, getUser, setUser } from './api'
import { CLINIC } from './constants'
import Login from './pages/Login'
import Patients from './pages/Patients'
import PatientForm from './pages/PatientForm'
import PatientDetail from './pages/PatientDetail'
import RecordForm from './pages/RecordForm'
import Doctors from './pages/Doctors'
import Upcoming from './pages/Upcoming'
import Dashboard from './pages/Dashboard'

function RequireAuth() {
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setOk(false)
      setReady(true)
      return undefined
    }
    let cancelled = false
    api('/api/auth/me')
      .then((user) => {
        if (!cancelled) {
          setUser(user)
          setOk(true)
        }
      })
      .catch(() => {
        if (!cancelled) setOk(false)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) return <div className="center-note">Checking session…</div>
  if (!ok) return <Navigate to="/login" replace />
  return <Outlet />
}

function Shell() {
  const navigate = useNavigate()
  const user = getUser()
  const isOwner = user.role === 'owner'

  function logout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">J</span>
          <div>
            <strong>{CLINIC.name}</strong>
            <small>{CLINIC.location} · {user.name || user.username || 'Staff'} ({user.role || 'admin'})</small>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/patients">Patients</NavLink>
          {!isOwner && <NavLink to="/upcoming">Upcoming</NavLink>}
          {!isOwner && <NavLink to="/doctors">Doctors</NavLink>}
        </nav>
        <button className="btn ghost" type="button" onClick={logout}>Log out</button>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

function HomeRedirect() {
  const user = getUser()
  return <Navigate to={user.role === 'owner' ? '/dashboard' : '/patients'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<PatientForm />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/patients/:id/edit" element={<PatientForm />} />
          <Route path="/patients/:id/records/new" element={<RecordForm />} />
          <Route path="/patients/:id/records/:recordId/edit" element={<RecordForm />} />
          <Route path="/upcoming" element={<Upcoming />} />
          <Route path="/doctors" element={<Doctors />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
