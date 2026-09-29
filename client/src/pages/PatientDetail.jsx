import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { getUser } from '../api'
import { CATEGORIES, HISTORY_FIELDS, emptyMedicine, formatDate, formatInr, formatMedicine, formatWhen, genderLabel, medicineTracker, paymentSummary, visitBilled, visitPaid } from '../constants'
import ReminderActions from '../components/ReminderActions'
import PatientReport from '../components/PatientReport'

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [records, setRecords] = useState([])
  const [clinic, setClinic] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingMed, setEditingMed] = useState(null)

  function load() {
    setLoading(true)
    return api(`/api/patients/${id}`)
      .then((data) => {
        setPatient(data.patient)
        setRecords(data.records || [])
        setClinic(data.clinic || null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api(`/api/patients/${id}`)
      .then((data) => {
        if (cancelled) return
        setPatient(data.patient)
        setRecords(data.records || [])
        setClinic(data.clinic || null)
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

  async function removePatient() {
    if (!patient) return
    const ok = window.confirm(`Delete ${patient.name} and all visit records?`)
    if (!ok) return
    try {
      await api(`/api/patients/${id}`, { method: 'DELETE' })
      navigate('/patients')
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeRecord(record) {
    const ok = window.confirm(`Delete the visit on ${formatDate(record.visit_date)}?`)
    if (!ok) return
    try {
      await api(`/api/records/${record._id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveMedicineEdit(updatedMedicine, remove = false) {
    const record = records.find((item) => item._id === editingMed.record_id)
    if (!record) throw new Error('Visit not found')
    const medicines = [...(record.medicines || [])]
    if (remove) {
      medicines.splice(editingMed.medicine_index, 1)
    } else {
      medicines[editingMed.medicine_index] = {
        id: updatedMedicine.id || editingMed.id || '',
        name: updatedMedicine.name.trim(),
        dose: updatedMedicine.dose.trim(),
        frequency: updatedMedicine.frequency.trim(),
        duration: updatedMedicine.duration.trim(),
        instructions: updatedMedicine.instructions.trim(),
        given_date: updatedMedicine.given_date || record.visit_date
      }
    }
    await api(`/api/records/${record._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...record,
        patient_id: record.patient_id,
        medicines
      })
    })
    setEditingMed(null)
    await load()
  }

  async function addMedicineToVisit(record) {
    const blank = emptyMedicine(record.visit_date)
    setEditingMed({
      ...blank,
      record_id: record._id,
      medicine_index: (record.medicines || []).length,
      visit_date: record.visit_date,
      isNew: true,
      category_label: record.category_label || '',
      assisting_doctor: record.assisting_doctor || ''
    })
  }

  async function saveNewMedicine(updatedMedicine) {
    const record = records.find((item) => item._id === editingMed.record_id)
    if (!record) throw new Error('Visit not found')
    const medicines = [...(record.medicines || []), {
      name: updatedMedicine.name.trim(),
      dose: updatedMedicine.dose.trim(),
      frequency: updatedMedicine.frequency.trim(),
      duration: updatedMedicine.duration.trim(),
      instructions: updatedMedicine.instructions.trim(),
      given_date: updatedMedicine.given_date || record.visit_date
    }]
    await api(`/api/records/${record._id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...record,
        patient_id: record.patient_id,
        medicines
      })
    })
    setEditingMed(null)
    await load()
  }

  if (loading) return <p className="muted">Loading patient…</p>
  if (!patient) return <p className="form-error">{error || 'Patient not found'}</p>

  const known = new Set(CATEGORIES.map((category) => category.id))
  const grouped = CATEGORIES.map((category) => ({
    ...category,
    items: records.filter((record) => record.category === category.id)
  }))
  const other = records.filter((record) => !known.has(record.category))
  const tracker = medicineTracker(records)
  const payments = paymentSummary(records)
  const canEdit = getUser().role !== 'owner'

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Reg. {patient.reg_no || '—'} · {formatDate(patient.reg_date)}</p>
          <h1>{patient.name}</h1>
        </div>
        <div className="row-actions">
          <Link className="btn ghost" to="/patients">All patients</Link>
          {canEdit && <Link className="btn" to={`/patients/${id}/edit`}>Edit patient</Link>}
          {canEdit && <Link className="btn primary" to={`/patients/${id}/records/new`}>Add visit</Link>}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="split">
        <article className="panel">
          <h2>Patient</h2>
          <dl className="facts">
            <div className="wide"><dt>Category</dt><dd>{patient.category_label || '—'}</dd></div>
            <div><dt>Age</dt><dd>{patient.age ?? '—'}</dd></div>
            <div><dt>Gender</dt><dd>{genderLabel(patient.gender)}</dd></div>
            <div><dt>Mobile</dt><dd>{patient.mobile || '—'}</dd></div>
            <div className="wide">
              <dt>Email (reminders)</dt>
              <dd>
                {patient.email || '— not set —'}
                {canEdit && (
                  <>
                    {' '}
                    <Link className="linkish" to={`/patients/${id}/edit`}>Change email / details</Link>
                  </>
                )}
              </dd>
            </div>
            <div className="wide"><dt>Address</dt><dd>{patient.address || '—'}</dd></div>
          </dl>
          <h3>Medical history</h3>
          <div className="pills">
            {HISTORY_FIELDS.map((field) => {
              const on = Boolean(patient.medical_history?.[field.key])
              return (
                <span key={field.key} className={on ? 'pill on' : 'pill'}>
                  {field.label}: {on ? 'Yes' : 'No'}
                </span>
              )
            })}
          </div>
          {patient.medication_details && (
            <>
              <h3>Medication</h3>
              <p>{patient.medication_details}</p>
            </>
          )}
          {patient.notes && (
            <>
              <h3>Notes</h3>
              <p>{patient.notes}</p>
            </>
          )}
          <div className="row-actions">
            <PatientReport patient={patient} records={records} clinic={clinic} />
            {canEdit && <button className="btn danger" type="button" onClick={removePatient}>Delete patient</button>}
          </div>
        </article>
        <article className="panel quiet">
          <h2>Reminders</h2>
          <p className="muted">Copies a WhatsApp message for the next appointment, or sends the same text by email.</p>
          <ReminderActions patientId={patient._id} email={patient.email} />
        </article>
      </div>

      <section className="panel tracker">
        <div className="page-head">
          <div>
            <p className="eyebrow">Hospital accounts</p>
            <h2>Payments</h2>
            <p className="muted">Internal only — not included in WhatsApp or email reminders.</p>
          </div>
          <div className="pay-summary">
            <span>Billed {formatInr(payments.totals.billed)}</span>
            <span>Paid {formatInr(payments.totals.paid)}</span>
            <span>Balance {formatInr(payments.totals.balance)}</span>
          </div>
        </div>
        {payments.rows.length === 0 ? (
          <p className="muted">No visit payments yet. Add OP / treatment / other and cash or GPay when saving a visit.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit</th>
                  <th>OP</th>
                  <th>Treatment</th>
                  <th>Other</th>
                  <th>Cash</th>
                  <th>GPay</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.rows.map((row) => (
                  <tr key={row.record_id}>
                    <td data-label="Visit">{formatDate(row.visit_date)}</td>
                    <td data-label="OP">{formatInr(row.op_amount)}</td>
                    <td data-label="Treatment">{formatInr(row.treatment_amount)}</td>
                    <td data-label="Other">{formatInr(row.other_amount)}</td>
                    <td data-label="Cash">
                      {formatInr(row.cash_amount)}
                      {row.cash_date ? ` · ${formatDate(row.cash_date)}` : ''}
                    </td>
                    <td data-label="GPay">
                      {formatInr(row.gpay_amount)}
                      {row.gpay_date ? ` · ${formatDate(row.gpay_date)}` : ''}
                    </td>
                    <td data-label="Balance">{formatInr(row.balance)}</td>
                    <td data-label="Edit">
                      {canEdit ? (
                        <Link className="btn small" to={`/patients/${id}/records/${row.record_id}/edit`}>Edit</Link>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel tracker">
        <div className="page-head">
          <div>
            <p className="eyebrow">Tracker</p>
            <h2>Medicines given</h2>
            <p className="muted">Click Edit to change medicine name, dose, date, or any other detail.</p>
          </div>
          <span className="count">{tracker.length === 1 ? '1 entry' : `${tracker.length} entries`}</span>
        </div>
        {tracker.length === 0 ? (
          <p className="muted">No medicines recorded yet. Add them when you save a visit, or use Add medicine on a visit.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date given</th>
                  <th>Medicine</th>
                  <th>Dose</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Instructions</th>
                  <th>Doctor / Dept</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracker.map((item) => (
                  <tr key={`${item.record_id}-${item.medicine_index}-${item.id || item.name}`}>
                    <td data-label="Date given">{formatDate(item.given_date || item.visit_date)}</td>
                    <td data-label="Medicine">{item.name}</td>
                    <td data-label="Dose">{item.dose || '—'}</td>
                    <td data-label="Frequency">{item.frequency || '—'}</td>
                    <td data-label="Duration">{item.duration || '—'}</td>
                    <td data-label="Instructions">{item.instructions || '—'}</td>
                    <td data-label="Doctor / Dept">
                      {[item.assisting_doctor, item.category_label].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td data-label="Actions">
                      {canEdit ? (
                        <div className="row-actions">
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => setEditingMed({ ...item, isNew: false })}
                          >
                            Edit
                          </button>
                          <Link className="btn small ghost" to={`/patients/${id}/records/${item.record_id}/edit`}>
                            Visit
                          </Link>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <h2 className="section-title">Visits by department</h2>
      {grouped.map((group) => (
        <section key={group.id} className="dept">
          <header>
            <h3>{group.label}</h3>
            <span>{group.items.length}</span>
          </header>
          {group.items.length === 0 ? <p className="muted">No visits</p> : group.items.map((record) => (
            <VisitCard
              key={record._id}
              record={record}
              patient={patient}
              canEdit={canEdit}
              onDelete={() => removeRecord(record)}
              onEditMedicine={(med, medicineIndex) => setEditingMed({
                ...med,
                given_date: med.given_date || record.visit_date,
                record_id: record._id,
                medicine_index: medicineIndex,
                visit_date: record.visit_date,
                category_label: record.category_label || '',
                assisting_doctor: record.assisting_doctor || '',
                isNew: false
              })}
              onAddMedicine={() => addMedicineToVisit(record)}
            />
          ))}
        </section>
      ))}
      {other.length > 0 && (
        <section className="dept">
          <header><h3>Other</h3><span>{other.length}</span></header>
          {other.map((record) => (
            <VisitCard
              key={record._id}
              record={record}
              patient={patient}
              canEdit={canEdit}
              onDelete={() => removeRecord(record)}
              onEditMedicine={(med, medicineIndex) => setEditingMed({
                ...med,
                given_date: med.given_date || record.visit_date,
                record_id: record._id,
                medicine_index: medicineIndex,
                visit_date: record.visit_date,
                category_label: record.category_label || '',
                assisting_doctor: record.assisting_doctor || '',
                isNew: false
              })}
              onAddMedicine={() => addMedicineToVisit(record)}
            />
          ))}
        </section>
      )}

      {editingMed && canEdit && (
        <MedicineEditModal
          item={editingMed}
          onClose={() => setEditingMed(null)}
          onSave={editingMed.isNew ? saveNewMedicine : (med) => saveMedicineEdit(med, false)}
          onDelete={editingMed.isNew ? null : () => saveMedicineEdit(editingMed, true)}
        />
      )}
    </section>
  )
}

function VisitCard({ record, patient, canEdit, onDelete, onEditMedicine, onAddMedicine }) {
  const medicines = record.medicines || []
  const billed = visitBilled(record)
  const paid = visitPaid(record)
  const cash = Number(record.cash_amount) || 0
  const gpay = Number(record.gpay_amount) || 0
  return (
    <article className="visit">
      <div className="visit-top">
        <strong>{formatDate(record.visit_date)}</strong>
        <span>{record.assisting_doctor || 'No doctor listed'}</span>
      </div>
      <dl className="facts">
        <div className="wide"><dt>Chief complaint</dt><dd>{record.chief_complaint || '—'}</dd></div>
        <div className="wide"><dt>Treatment plan</dt><dd>{record.treatment_plan || '—'}</dd></div>
        <div className="wide"><dt>Notes</dt><dd>{record.treatment_notes || '—'}</dd></div>
        <div><dt>OP</dt><dd>{formatInr(record.op_amount)}</dd></div>
        <div><dt>Treatment</dt><dd>{formatInr(record.treatment_amount)}</dd></div>
        <div><dt>Other</dt><dd>{formatInr(record.other_amount)}</dd></div>
        <div>
          <dt>Cash</dt>
          <dd>
            {formatInr(cash)}
            {record.cash_date ? ` · ${formatDate(record.cash_date)}` : ''}
          </dd>
        </div>
        <div>
          <dt>GPay</dt>
          <dd>
            {formatInr(gpay)}
            {record.gpay_date ? ` · ${formatDate(record.gpay_date)}` : ''}
          </dd>
        </div>
        <div><dt>Total / Paid</dt><dd>{formatInr(billed)} / {formatInr(paid)}</dd></div>
        <div className="wide">
          <dt>Medicines</dt>
          <dd>
            {medicines.length === 0 ? '—' : (
              <ul className="med-list">
                {medicines.map((med, index) => (
                  <li key={med.id || index}>
                    <span>{formatDate(med.given_date || record.visit_date)} — {formatMedicine(med)}</span>
                    {canEdit && (
                      <>
                        {' '}
                        <button className="linkish" type="button" onClick={() => onEditMedicine(med, index)}>Edit</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {record.prescription_notes && (
          <div className="wide"><dt>Prescription notes</dt><dd>{record.prescription_notes}</dd></div>
        )}
        <div className="wide">
          <dt>Next appointment</dt>
          <dd>{record.next_appointment ? formatWhen(record.next_appointment, record.appointment_time) : '—'}</dd>
        </div>
      </dl>
      {canEdit && (
        <div className="row-actions">
          <Link className="btn small" to={`/patients/${patient._id}/records/${record._id}/edit`}>Edit visit</Link>
          <button className="btn small" type="button" onClick={onAddMedicine}>Add medicine</button>
          <button className="btn small danger" type="button" onClick={onDelete}>Delete</button>
        </div>
      )}
      {canEdit && <ReminderActions patientId={patient._id} recordId={record._id} email={patient.email} compact />}
    </article>
  )
}

function MedicineEditModal({ item, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    id: item.id || '',
    name: item.name || '',
    dose: item.dose || '',
    frequency: item.frequency || '',
    duration: item.duration || '',
    instructions: item.instructions || '',
    given_date: item.given_date || item.visit_date || ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Medicine name is required')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!onDelete) return
    if (!window.confirm(`Remove ${form.name || 'this medicine'} from the tracker?`)) return
    setBusy(true)
    setError('')
    try {
      await onDelete()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-bar">
          <strong>{item.isNew ? 'Add medicine' : 'Edit medicine'}</strong>
          <button className="btn ghost" type="button" onClick={onClose}>Close</button>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>
            Date given
            <input
              type="date"
              value={form.given_date}
              onChange={(event) => setForm({ ...form, given_date: event.target.value })}
              required
            />
          </label>
          <label>
            Medicine
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label>
            Dose
            <input value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} />
          </label>
          <label>
            Frequency
            <input value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} />
          </label>
          <label>
            Duration
            <input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
          </label>
          <label className="span-2">
            Instructions
            <input
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
            />
          </label>
          {error && <p className="form-error span-2">{error}</p>}
          <div className="row-actions span-2">
            <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save medicine'}</button>
            {onDelete && (
              <button className="btn danger" type="button" onClick={remove} disabled={busy}>Delete medicine</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
