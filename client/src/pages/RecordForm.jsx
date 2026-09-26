import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { CATEGORIES, emptyMedicine } from '../constants'

function mapMedicines(list, visitDate) {
  if (Array.isArray(list) && list.length) {
    return list.map((med) => ({
      id: med.id || '',
      name: med.name || '',
      dose: med.dose || '',
      frequency: med.frequency || '',
      duration: med.duration || '',
      instructions: med.instructions || '',
      given_date: med.given_date || visitDate || ''
    }))
  }
  return [emptyMedicine(visitDate || '')]
}

export default function RecordForm() {
  const { id, recordId } = useParams()
  const editing = Boolean(recordId)
  const navigate = useNavigate()
  const [patientName, setPatientName] = useState('')
  const [doctors, setDoctors] = useState([])
  const [doctorPick, setDoctorPick] = useState('')
  const [form, setForm] = useState({
    category: 'conservative_endodontics',
    visit_date: '',
    chief_complaint: '',
    treatment_plan: '',
    treatment_notes: '',
    medicines: [emptyMedicine()],
    prescription_notes: '',
    op_amount: '',
    treatment_amount: '',
    other_amount: '',
    amount_paid: '',
    billing_notes: '',
    assisting_doctor: '',
    next_appointment: '',
    appointment_time: ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api(`/api/patients/${id}`),
      api('/api/doctors')
    ])
      .then(([patientData, doctorData]) => {
        if (cancelled) return
        setPatientName(patientData.patient?.name || '')
        setDoctors(doctorData.doctors || [])
        if (!recordId && patientData.patient?.category) {
          setForm((current) => ({ ...current, category: patientData.patient.category }))
        }
        if (recordId) {
          const record = (patientData.records || []).find((item) => item._id === recordId)
          if (!record) {
            setError('Visit not found')
            return
          }
          setForm({
            category: record.category || 'conservative_endodontics',
            visit_date: record.visit_date || '',
            chief_complaint: record.chief_complaint || '',
            treatment_plan: record.treatment_plan || '',
            treatment_notes: record.treatment_notes || '',
            medicines: mapMedicines(record.medicines, record.visit_date),
            prescription_notes: record.prescription_notes || '',
            op_amount: record.op_amount ?? '',
            treatment_amount: record.treatment_amount ?? '',
            other_amount: record.other_amount ?? '',
            amount_paid: record.amount_paid ?? '',
            billing_notes: record.billing_notes || '',
            assisting_doctor: record.assisting_doctor || '',
            next_appointment: record.next_appointment || '',
            appointment_time: record.appointment_time || ''
          })
          const match = (doctorData.doctors || []).find((doctor) => doctor.name === record.assisting_doctor)
          setDoctorPick(match ? match._id : '')
        }
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
  }, [id, recordId])

  function setField(key, value) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'visit_date') {
        next.medicines = current.medicines.map((med) => (
          med.given_date ? med : { ...med, given_date: value }
        ))
      }
      return next
    })
  }

  function setMedicine(index, key, value) {
    setForm((current) => ({
      ...current,
      medicines: current.medicines.map((med, i) => (i === index ? { ...med, [key]: value } : med))
    }))
  }

  function addMedicine() {
    setForm((current) => ({
      ...current,
      medicines: [...current.medicines, emptyMedicine(current.visit_date)]
    }))
  }

  function removeMedicine(index) {
    setForm((current) => {
      const next = current.medicines.filter((_, i) => i !== index)
      return { ...current, medicines: next.length ? next : [emptyMedicine(current.visit_date)] }
    })
  }

  function chooseDoctor(value) {
    setDoctorPick(value)
    const doctor = doctors.find((item) => item._id === value)
    if (doctor) setField('assisting_doctor', doctor.name)
  }

  async function onSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const medicines = form.medicines
      .filter((med) => med.name.trim())
      .map((med) => ({
        ...med,
        given_date: med.given_date || form.visit_date
      }))
    const payload = {
      ...form,
      medicines,
      patient_id: id,
      op_amount: form.op_amount === '' ? 0 : Number(form.op_amount),
      treatment_amount: form.treatment_amount === '' ? 0 : Number(form.treatment_amount),
      other_amount: form.other_amount === '' ? 0 : Number(form.other_amount),
      amount_paid: form.amount_paid === '' ? 0 : Number(form.amount_paid)
    }
    try {
      if (editing) {
        await api(`/api/records/${recordId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await api('/api/records', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      navigate(`/patients/${id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Loading visit form…</p>

  return (
    <form className="panel" onSubmit={onSubmit}>
      <div className="page-head">
        <div>
          <p className="eyebrow">{patientName || 'Patient'}</p>
          <h1>{editing ? 'Edit visit' : 'Add visit'}</h1>
        </div>
        <Link className="btn ghost" to={`/patients/${id}`}>Cancel</Link>
      </div>

      <div className="form-grid">
        <label className="span-2">
          Category
          <select value={form.category} onChange={(event) => setField('category', event.target.value)} required>
            {CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label>
          Visit date
          <input
            type="date"
            value={form.visit_date}
            onChange={(event) => setField('visit_date', event.target.value)}
            required
          />
        </label>
        <label>
          Assisting doctor
          <select value={doctorPick} onChange={(event) => chooseDoctor(event.target.value)}>
            <option value="">Choose from list</option>
            {doctors.map((doctor) => (
              <option key={doctor._id} value={doctor._id}>{doctor.name}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Or type the doctor name
          <input
            value={form.assisting_doctor}
            onChange={(event) => {
              setDoctorPick('')
              setField('assisting_doctor', event.target.value)
            }}
            placeholder="Dr. Sebi"
          />
        </label>
        <label className="span-2">
          Chief complaint
          <textarea
            rows={3}
            value={form.chief_complaint}
            onChange={(event) => setField('chief_complaint', event.target.value)}
            placeholder="pt c/o decay"
          />
        </label>
        <label className="span-2">
          Treatment plan
          <textarea
            rows={3}
            value={form.treatment_plan}
            onChange={(event) => setField('treatment_plan', event.target.value)}
          />
        </label>
        <label className="span-2">
          Treatment notes
          <textarea
            rows={3}
            value={form.treatment_notes}
            onChange={(event) => setField('treatment_notes', event.target.value)}
          />
        </label>
      </div>

      <fieldset className="med-box">
        <legend>Medicines given by doctor</legend>
        <p className="muted">Edit any medicine, dose, and the date it was given. Empty medicine rows are ignored when saving.</p>
        {form.medicines.map((med, index) => (
          <div key={med.id || index} className="med-row">
            <label>
              Date given
              <input
                type="date"
                value={med.given_date}
                onChange={(event) => setMedicine(index, 'given_date', event.target.value)}
              />
            </label>
            <label>
              Medicine
              <input
                value={med.name}
                onChange={(event) => setMedicine(index, 'name', event.target.value)}
                placeholder="Amoxicillin"
              />
            </label>
            <label>
              Dose
              <input
                value={med.dose}
                onChange={(event) => setMedicine(index, 'dose', event.target.value)}
                placeholder="500 mg"
              />
            </label>
            <label>
              Frequency
              <input
                value={med.frequency}
                onChange={(event) => setMedicine(index, 'frequency', event.target.value)}
                placeholder="1-0-1 / twice daily"
              />
            </label>
            <label>
              Duration
              <input
                value={med.duration}
                onChange={(event) => setMedicine(index, 'duration', event.target.value)}
                placeholder="5 days"
              />
            </label>
            <label className="span-wide">
              Instructions
              <input
                value={med.instructions}
                onChange={(event) => setMedicine(index, 'instructions', event.target.value)}
                placeholder="After food"
              />
            </label>
            <button className="btn small danger" type="button" onClick={() => removeMedicine(index)}>
              Remove
            </button>
          </div>
        ))}
        <button className="btn" type="button" onClick={addMedicine}>Add medicine</button>
        <label>
          Other prescription notes
          <textarea
            rows={2}
            value={form.prescription_notes}
            onChange={(event) => setField('prescription_notes', event.target.value)}
            placeholder="Any extra advice given with the medicines"
          />
        </label>
      </fieldset>

      <fieldset className="med-box">
        <legend>Hospital billing (internal only)</legend>
        <p className="muted">Not sent in WhatsApp or email reminders. For clinic accounts only.</p>
        <div className="form-grid">
          <label>
            OP amount (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.op_amount}
              onChange={(event) => setField('op_amount', event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Treatment amount (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.treatment_amount}
              onChange={(event) => setField('treatment_amount', event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Other amount (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.other_amount}
              onChange={(event) => setField('other_amount', event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Amount taken / paid (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount_paid}
              onChange={(event) => setField('amount_paid', event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="span-2">
            Billing notes
            <input
              value={form.billing_notes}
              onChange={(event) => setField('billing_notes', event.target.value)}
              placeholder="Partial payment / UPI / cash"
            />
          </label>
        </div>
      </fieldset>

      <div className="form-grid">
        <label>
          Next appointment
          <input
            type="date"
            value={form.next_appointment}
            onChange={(event) => setField('next_appointment', event.target.value)}
          />
        </label>
        <label>
          Time
          <input
            type="time"
            value={form.appointment_time}
            onChange={(event) => setField('appointment_time', event.target.value)}
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="row-actions">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save visit'}
        </button>
      </div>
    </form>
  )
}
