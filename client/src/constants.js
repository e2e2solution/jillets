export const CLINIC = {
  name: 'Jillet Dental Care',
  location: 'Pallikkara',
  phone: '91 95678 02796',
  tagline: 'Premium Dental Clinic'
}

export const CATEGORIES = [
  { id: 'conservative_endodontics', label: 'Conservative dentistry & endodontics' },
  { id: 'prosthodontics', label: 'Prosthodontics' },
  { id: 'oral_maxillofacial_surgery', label: 'Oral & maxillofacial surgery' },
  { id: 'pedodontics', label: 'Pedodontics' },
  { id: 'periodontics', label: 'Periodontics' },
  { id: 'orthodontics', label: 'Orthodontics' },
  { id: 'oral_pathology_medicine', label: 'Oral pathology & oral medicine' }
]

export const HISTORY_FIELDS = [
  { key: 'diabetic', label: 'Diabetic' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'heart_disease', label: 'Heart Disease' },
  { key: 'epilepsy', label: 'Epilepsy' },
  { key: 'allergy', label: 'Allergy' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'pregnancy', label: 'Pregnancy' },
  { key: 'lactation', label: 'Lactation' }
]

export function emptyHistory() {
  return Object.fromEntries(HISTORY_FIELDS.map((field) => [field.key, false]))
}

export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function formatWhen(date, time) {
  if (!date) return '—'
  const shown = formatDate(date)
  return time ? `${shown} at ${String(time).slice(0, 5)}` : shown
}

export function genderLabel(code) {
  if (code === 'M') return 'Male'
  if (code === 'F') return 'Female'
  if (code === 'O') return 'Other'
  return '—'
}

export function emptyMedicine(givenDate = '') {
  return {
    id: '',
    name: '',
    dose: '',
    frequency: '',
    duration: '',
    instructions: '',
    given_date: givenDate
  }
}

export function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function visitBilled(record) {
  return money(
    money(record?.op_amount) + money(record?.treatment_amount) + money(record?.other_amount)
  )
}

export function formatInr(value) {
  const amount = money(value)
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function paymentSummary(records) {
  const rows = (records || []).map((record) => {
    const billed = visitBilled(record)
    const paid = money(record.amount_paid)
    return {
      record_id: record._id,
      visit_date: record.visit_date,
      category_label: record.category_label || '',
      assisting_doctor: record.assisting_doctor || '',
      op_amount: money(record.op_amount),
      treatment_amount: money(record.treatment_amount),
      other_amount: money(record.other_amount),
      billed,
      paid,
      balance: money(billed - paid),
      billing_notes: record.billing_notes || ''
    }
  }).sort((a, b) => String(b.visit_date).localeCompare(String(a.visit_date)))

  const totals = rows.reduce((acc, row) => ({
    op: money(acc.op + row.op_amount),
    treatment: money(acc.treatment + row.treatment_amount),
    other: money(acc.other + row.other_amount),
    billed: money(acc.billed + row.billed),
    paid: money(acc.paid + row.paid),
    balance: money(acc.balance + row.balance)
  }), { op: 0, treatment: 0, other: 0, billed: 0, paid: 0, balance: 0 })

  return { rows, totals }
}

export function formatMedicine(med) {
  if (!med?.name) return ''
  const parts = [med.name]
  if (med.dose) parts.push(med.dose)
  if (med.frequency) parts.push(med.frequency)
  if (med.duration) parts.push(med.duration)
  if (med.instructions) parts.push(`(${med.instructions})`)
  return parts.join(' · ')
}

export function medicineTracker(records) {
  const items = []
  for (const record of records || []) {
    const list = record.medicines || []
    list.forEach((med, medicineIndex) => {
      if (!med?.name) return
      items.push({
        ...med,
        given_date: med.given_date || record.visit_date || '',
        visit_date: record.visit_date,
        category_label: record.category_label || '',
        assisting_doctor: record.assisting_doctor || '',
        record_id: record._id,
        medicine_index: medicineIndex
      })
    })
  }
  return items.sort((a, b) => String(b.given_date || '').localeCompare(String(a.given_date || '')))
}
