import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { formatDate, formatWhen } from '../constants'
import ReminderActions from '../components/ReminderActions'

export default function Upcoming() {
  const [days, setDays] = useState(14)
  const [records, setRecords] = useState([])
  const [range, setRange] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api(`/api/records/upcoming?days=${days}`)
      .then((data) => {
        if (cancelled) return
        setRecords(data.records || [])
        setRange({ from: data.from, to: data.to })
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
  }, [days])

  const groups = []
  for (const record of records) {
    const last = groups[groups.length - 1]
    if (!last || last.date !== record.next_appointment) {
      groups.push({ date: record.next_appointment, items: [record] })
    } else {
      last.items.push(record)
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Upcoming appointments</h1>
          {range && <p className="muted">{formatDate(range.from)} – {formatDate(range.to)}</p>}
        </div>
        <label className="inline-field">
          Window
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? <p className="muted">Loading appointments…</p> : groups.length === 0 ? (
        <div className="empty">No appointments in this window.</div>
      ) : groups.map((group) => (
        <section key={group.date} className="dept">
          <header>
            <h3>{formatDate(group.date)}</h3>
            <span>{group.items.length}</span>
          </header>
          {group.items.map((record) => (
            <article key={record._id} className="visit">
              <div className="visit-top">
                <strong>
                  <Link to={`/patients/${record.patient_id}`}>{record.patient_name}</Link>
                </strong>
                <span>{formatWhen(record.next_appointment, record.appointment_time)}</span>
              </div>
              <p className="muted">
                {[record.patient_reg_no && `Reg. ${record.patient_reg_no}`, record.patient_mobile, record.category_label, record.assisting_doctor]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {record.chief_complaint && <p>{record.chief_complaint}</p>}
              <ReminderActions
                patientId={record.patient_id}
                recordId={record._id}
                email={record.patient_email}
                compact
              />
            </article>
          ))}
        </section>
      ))}
    </section>
  )
}
