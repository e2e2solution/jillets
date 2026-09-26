import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getUser } from '../api'
import { CATEGORIES, formatDate, genderLabel } from '../constants'

export default function Patients() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: params.get('q') || '',
    mobile: params.get('mobile') || '',
    date: params.get('date') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
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
    setDraft({ q: '', mobile: '', date: '', from: '', to: '', category: '' })
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

      <form className="filters" onSubmit={onSearch}>
        <label>
          Name, mobile, or reg. no.
          <input
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            placeholder="Search Ajaykumar, 9048…, 2340"
          />
        </label>
        <label>
          Mobile number
          <input
            value={draft.mobile}
            onChange={(event) => setDraft({ ...draft, mobile: event.target.value })}
            inputMode="numeric"
            placeholder="9048694647"
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
        <label>
          Date (reg. or visit)
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
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
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reg. no.</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Reg. date</th>
                    <th>Address</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient._id} onClick={() => navigate(`/patients/${patient._id}`)}>
                      <td data-label="Reg. no.">{patient.reg_no || '—'}</td>
                      <td data-label="Name">{patient.name}</td>
                      <td data-label="Category">{patient.category_label || '—'}</td>
                      <td data-label="Age">{patient.age ?? '—'}</td>
                      <td data-label="Gender">{genderLabel(patient.gender)}</td>
                      <td data-label="Mobile">{patient.mobile || '—'}</td>
                      <td data-label="Email">{patient.email || '—'}</td>
                      <td data-label="Reg. date">{formatDate(patient.reg_date)}</td>
                      <td data-label="Address">{patient.address || '—'}</td>
                      {canEdit && (
                        <td data-label="Edit">
                          <Link
                            className="btn small"
                            to={`/patients/${patient._id}/edit`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            Edit
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
