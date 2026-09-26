import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getToken, setToken, setUser } from '../api'
import { CLINIC } from '../constants'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mongo, setMongo] = useState(null)

  useEffect(() => {
    if (getToken()) {
      api('/api/auth/me')
        .then((user) => {
          setUser(user)
          navigate(user.role === 'owner' ? '/dashboard' : '/patients', { replace: true })
        })
        .catch(() => {})
    }
    api('/api/health')
      .then((data) => setMongo(Boolean(data.mongo)))
      .catch(() => setMongo(false))
  }, [navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      })
      setToken(data.token)
      setUser({ username: data.username, role: data.role, name: data.name })
      navigate(data.role === 'owner' ? '/dashboard' : '/patients', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <p className="eyebrow">{CLINIC.tagline}</p>
        <h1>{CLINIC.name}</h1>
        <p className="muted">{CLINIC.location} · {CLINIC.phone}</p>
        <label>
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted">
          Clinic staff: <code>admin</code> · Owner dashboard: <code>owner</code>.
          Change either password in MongoDB <code>users</code> collection.
        </p>
        {mongo === false && (
          <p className="form-error">Database is not connected. Check Atlas network access and server/.env.</p>
        )}
      </form>
    </div>
  )
}
