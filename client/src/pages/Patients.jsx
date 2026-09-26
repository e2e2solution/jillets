import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getUser } from '../api'
import { CATEGORIES } from '../constants'

export default function Patients() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: params.get('q') || '',
    category: params.get('category') || ''
  })
  const [patients, setPatients] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const canEdit = getUser().role !== 'owner'

  useEffect(() => {
    const query = params.toString()
    let cancelled = false
    setLoading(true)
    api(`/api/patients${query ? `?${query}` : ''}`)
      .then((data) => {
        if (!cancelled) setPatients(data.patients || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [params])

  function onSearch(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    Object.entries(draft).forEach(([key, value]) => {
      if (value) next.set(key, value)
    })
    setParams(next)
  }

  function clearFilters() {
    setDraft({ q: '', category: '' })
    setParams(new URLSearchParams())
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Registry</p>
          <h1>Patients</h1>
        </div>
        {canEdit && <Link className="btn primary" to="/patients/new">Add patient</Link>}
      </div>

      <form className="filters filters-compact" onSubmit={onSearch}>
        <label>
          Search
          <input
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            placeholder="Name or code"
          />
        </label>
        <label>
          Category
          <select
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button className="btn primary" type="submit">Search</button>
          <button className="btn ghost" type="button" onClick={clearFilters}>Clear</button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? <p className="muted">Loading patients…</p> : (
        <>
          <p className="count">{patients.length === 1 ? '1 patient' : `${patients.length} patients`}</p>
          {patients.length === 0 ? (
            <div className="empty">No patients match these filters.</div>
          ) : (
            <ul className="patient-simple-list">
              {patients.map((patient) => (
                <li key={patient._id}>
                  <button
                    type="button"
                    className="patient-simple-row"
                    onClick={() => navigate(`/patients/${patient._id}`)}
                  >
                    <span className="patient-simple-name">{patient.name}</span>
                    <span className="patient-simple-code">{patient.reg_no || '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
