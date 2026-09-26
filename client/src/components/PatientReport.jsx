import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { CATEGORIES, CLINIC, HISTORY_FIELDS, formatDate, formatMedicine, formatWhen, genderLabel, medicineTracker } from '../constants'

function fileBase(patient) {
  const raw = patient.reg_no || patient.name || 'patient'
  return `jillet-${String(raw).replace(/[^\w\-]+/g, '_').slice(0, 40)}`
}

function ReportBody({ patient, records, clinic, sheetRef }) {
  const info = clinic?.name ? clinic : CLINIC
  const known = new Set(CATEGORIES.map((category) => category.id))
  const grouped = CATEGORIES.map((category) => ({
    ...category,
    items: records.filter((record) => record.category === category.id)
  })).filter((group) => group.items.length > 0)
  const other = records.filter((record) => !known.has(record.category))
  const sections = other.length
    ? [...grouped, { id: 'other', label: 'Other', items: other }]
    : grouped
  const tracker = medicineTracker(records)

  return (
    <article className="report-sheet" ref={sheetRef}>
      <header className="report-head">
        <p>{info.name}</p>
        <h2>Patient history</h2>
        <p>{info.location} · {info.phone}</p>
      </header>
      <h3>{patient.name}</h3>
      <p>
        Age {patient.age ?? '—'} · {genderLabel(patient.gender)} · Mobile {patient.mobile || '—'}
      </p>
      <p>Reg. {patient.reg_no || '—'} · {formatDate(patient.reg_date)}</p>
      <p>Category: {patient.category_label || '—'}</p>
      <p>{patient.address || '—'}</p>
      {patient.email && <p>{patient.email}</p>}
      <h4>Medical history</h4>
      <p>
        {HISTORY_FIELDS.map((field) => `${field.label}: ${patient.medical_history?.[field.key] ? 'Yes' : 'No'}`).join(' · ')}
      </p>
      {patient.medication_details && <p>Ongoing medication: {patient.medication_details}</p>}
      {patient.notes && <p>Notes: {patient.notes}</p>}
      <h4>Medicine tracker</h4>
      {tracker.length === 0 ? <p>No medicines recorded.</p> : (
        <ul>
          {tracker.map((item, index) => (
            <li key={`${item.record_id}-${index}`}>
              {formatDate(item.given_date || item.visit_date)} — {formatMedicine(item)}
              {(item.assisting_doctor || item.category_label) ? ` · ${[item.assisting_doctor, item.category_label].filter(Boolean).join(' · ')}` : ''}
            </li>
          ))}
        </ul>
      )}
      {sections.length === 0 && <p>No visits recorded.</p>}
      {sections.map((group) => (
        <section key={group.id}>
          <h4>{group.label}</h4>
          {group.items.map((record) => (
            <div key={record._id} className="report-visit">
              <p><strong>{formatDate(record.visit_date)}</strong> · {record.assisting_doctor || 'Doctor not listed'}</p>
              <p>Chief complaint: {record.chief_complaint || '—'}</p>
              <p>Treatment plan: {record.treatment_plan || '—'}</p>
              <p>Notes: {record.treatment_notes || '—'}</p>
              <p>
                Medicines: {(record.medicines || []).length
                  ? (record.medicines || []).map((med) => `${formatDate(med.given_date || record.visit_date)} ${formatMedicine(med)}`).join('; ')
                  : '—'}
              </p>
              {record.prescription_notes && <p>Prescription notes: {record.prescription_notes}</p>}
              <p>
                Next appointment: {record.next_appointment
                  ? formatWhen(record.next_appointment, record.appointment_time)
                  : '—'}
              </p>
            </div>
          ))}
        </section>
      ))}
      <footer>Generated {formatDate(new Date().toISOString().slice(0, 10))} · {info.name}</footer>
    </article>
  )
}

export default function PatientReport({ patient, records, clinic }) {
  const ref = useRef(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)

  async function download(kind) {
    setError('')
    setBusy(true)
    try {
      if (!ref.current) throw new Error('Report is not ready')
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      })
      const base = fileBase(patient)
      if (kind === 'image') {
        const link = document.createElement('a')
        link.href = canvas.toDataURL('image/png')
        link.download = `${base}.png`
        link.click()
        return
      }
      const image = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageHeight = (canvas.height * pageWidth) / canvas.width
      let heightLeft = imageHeight
      let position = 0
      pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
      heightLeft -= pageHeight
      while (heightLeft > 1) {
        position = heightLeft - imageHeight
        pdf.addPage()
        pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`${base}.pdf`)
    } catch (err) {
      setError(err.message || 'Could not create the report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="report-actions">
      <button className="btn" type="button" onClick={() => download('pdf')} disabled={busy}>Download PDF</button>
      <button className="btn" type="button" onClick={() => download('image')} disabled={busy}>Download image</button>
      <button className="btn ghost" type="button" onClick={() => setPreview(true)}>Preview</button>
      {error && <p className="form-error">{error}</p>}
      <div className="report-stage" aria-hidden="true">
        <ReportBody patient={patient} records={records} clinic={clinic} sheetRef={ref} />
      </div>
      {preview && (
        <div className="modal-back" onClick={() => setPreview(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-bar">
              <strong>Patient report</strong>
              <button className="btn ghost" type="button" onClick={() => setPreview(false)}>Close</button>
            </div>
            <div className="report-scroll">
              <ReportBody patient={patient} records={records} clinic={clinic} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
