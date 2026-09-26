import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { CATEGORIES, HISTORY_FIELDS, emptyHistory } from '../constants'

function blank() {
  return {
    name: '',
    age: '',
    gender: '',
    address: '',
    mobile: '',
    email: '',
    reg_no: '',
    reg_date: '',
    category: '',
    medical_history: emptyHistory(),
    medication_details: '',
    notes: ''
  }
}

export default function PatientForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(editing)

  useEffect(() => {
    if (!id) return undefined
    let cancelled = false
    api(`/api/patients/${id}`)
      .then((data) => {
        if (cancelled) return
        const patient = data.patient
        setForm({
          name: patient.name || '',
          age: patient.age ?? '',
          gender: patient.gender || '',
          address: patient.address || '',
          mobile: patient.mobile || '',
          email: patient.email || '',
          reg_no: patient.reg_no || '',
          reg_date: patient.reg_date || '',
          category: patient.category || CATEGORIES[0].id,
          medical_history: { ...emptyHistory(), ...(patient.medical_history || {}) },
          medication_details: patient.medication_details || '',
          notes: patient.notes || ''
        })
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
  }, [id])

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function setHistory(key, checked) {
    setForm((current) => ({
      ...current,
      medical_history: { ...current.medical_history, [key]: checked }
    }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const payload = {
      ...form,
      age: form.age === '' ? null : Number(form.age)
    }
    try {
      const data = await api(editing ? `/api/patients/${id}` : '/api/patients', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      })
      navigate(`/patients/${data.patient._id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Loading patient…</p>

  return (
    <form className="panel" onSubmit={onSubmit}>
      <div className="page-head">
        <div>
          <p className="eyebrow">Patient file</p>
          <h1>{editing ? 'Edit patient' : 'Add patient'}</h1>
        </div>
        <Link className="btn ghost" to={editing ? `/patients/${id}` : '/patients'}>Cancel</Link>
      </div>

      <div className="form-grid">
        <label>
          Patient name
          <input value={form.name} onChange={(event) => setField('name', event.target.value)} required />
        </label>
        <label className="span-2">
          Category
          <select value={form.category} onChange={(event) => setField('category', event.target.value)} required>
            <option value="">Select category</option>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label>
          Age
          <input
            type="number"
            min="0"
            max="150"
            value={form.age}
            onChange={(event) => setField('age', event.target.value)}
          />
        </label>
        <label>
          Gender
          <select value={form.gender} onChange={(event) => setField('gender', event.target.value)}>
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="O">Other</option>
          </select>
        </label>
        <label>
          Mobile (for SMS reminders)
          <input
            value={form.mobile}
            onChange={(event) => setField('mobile', event.target.value)}
            inputMode="numeric"
            placeholder="9048694647"
          />
          <small className="field-hint">10-digit number. Used for MSG91 SMS (5 days + 1 day before) when MSG91 is configured.</small>
        </label>
        <label className="span-2">
          Address
          <input value={form.address} onChange={(event) => setField('address', event.target.value)} />
        </label>
        <label className="span-2">
          Patient email (for automatic reminders)
          <input
            type="email"
            value={form.email}
            onChange={(event) => setField('email', event.target.value)}
            placeholder="patient@email.com"
          />
          <small className="field-hint">Required for auto emails 5 days before and 1 day before the appointment. Sent only to this address.</small>
        </label>
        <label>
          Reg. no.
          <input value={form.reg_no} onChange={(event) => setField('reg_no', event.target.value)} placeholder="2340" />
        </label>
        <label>
          Reg. date
          <input type="date" value={form.reg_date} onChange={(event) => setField('reg_date', event.target.value)} />
        </label>
      </div>

      <fieldset className="checks">
        <legend>Medical history</legend>
        {HISTORY_FIELDS.map((field) => (
          <label key={field.key} className="check">
            <input
              type="checkbox"
              checked={Boolean(form.medical_history[field.key])}
              onChange={(event) => setHistory(field.key, event.target.checked)}
            />
            {field.label}
          </label>
        ))}
      </fieldset>

      <label>
        Medication details
        <textarea
          rows={3}
          value={form.medication_details}
          onChange={(event) => setField('medication_details', event.target.value)}
        />
      </label>
      <label>
        Notes
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => setField('notes', event.target.value)}
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      <div className="row-actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save patient'}
        </button>
      </div>
    </form>
  )
}
