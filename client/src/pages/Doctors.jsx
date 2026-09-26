import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ name: '', specialty: '', phone: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  function load() {
    return api('/api/doctors')
      .then((data) => setDoctors(data.doctors || []))
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/doctors', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setForm({ name: '', specialty: '', phone: '' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(doctor) {
    if (!window.confirm(`Remove ${doctor.name} from the assisting list?`)) return
    try {
      await api(`/api/doctors/${doctor._id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Clinic</p>
          <h1>Assisting doctors</h1>
        </div>
      </div>

      <form className="panel form-grid" onSubmit={onSubmit}>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Dr. Sebi"
            required
          />
        </label>
        <label>
          Specialty
          <input
            value={form.specialty}
            onChange={(event) => setForm({ ...form, specialty: event.target.value })}
            placeholder="Endodontics"
          />
        </label>
        <label>
          Phone
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            inputMode="numeric"
          />
        </label>
        <div className="filter-actions">
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add doctor'}</button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? <p className="muted">Loading doctors…</p> : doctors.length === 0 ? (
        <div className="empty">No assisting doctors yet.</div>
      ) : (
        <ul className="doctor-list">
          {doctors.map((doctor) => (
            <li key={doctor._id}>
              <div>
                <strong>{doctor.name}</strong>
                <small>{[doctor.specialty, doctor.phone].filter(Boolean).join(' · ') || 'No extra details'}</small>
              </div>
              <button className="btn small danger" type="button" onClick={() => remove(doctor)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
