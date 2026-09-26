import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { CATEGORIES, categoryById } from '../utils/constants.js'
import { asyncHandler, httpError, clip, isIsoDate, isTime } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

function parseId(id) {
  if (!ObjectId.isValid(id)) throw httpError(400, 'Invalid id')
  return new ObjectId(id)
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

function normalizeMedicines(input, fallbackDate = '') {
  if (!Array.isArray(input)) return []
  const items = []
  for (const raw of input.slice(0, 40)) {
    const name = clip(raw?.name, 200)
    if (!name) continue
    let givenDate = clip(raw?.given_date, 10)
    if (givenDate && !isIsoDate(givenDate)) {
      throw httpError(400, `Medicine date for ${name} must be YYYY-MM-DD`)
    }
    if (!givenDate && fallbackDate) givenDate = fallbackDate
    items.push({
      id: clip(raw?.id, 40) || new ObjectId().toString(),
      name,
      dose: clip(raw?.dose, 80),
      frequency: clip(raw?.frequency, 120),
      duration: clip(raw?.duration, 80),
      instructions: clip(raw?.instructions, 400),
      given_date: givenDate
    })
  }
  return items
}

function money(value) {
  if (value === '' || value === null || value === undefined) return 0
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw httpError(400, 'Amounts must be zero or a positive number')
  return Math.round(n * 100) / 100
}

function normalizeRecord(body) {
  const category = categoryById(clip(body?.category, 80))
  if (!category) throw httpError(400, 'A valid treatment category is required')
  const visitDate = clip(body?.visit_date, 10)
  if (!isIsoDate(visitDate)) throw httpError(400, 'Visit date is required (YYYY-MM-DD)')
  const nextAppointment = clip(body?.next_appointment, 10)
  if (nextAppointment && !isIsoDate(nextAppointment)) {
    throw httpError(400, 'Next appointment must be YYYY-MM-DD')
  }
  let appointmentTime = clip(body?.appointment_time, 5)
  if (appointmentTime && !isTime(appointmentTime)) throw httpError(400, 'Appointment time must be HH:mm')
  if (!nextAppointment) appointmentTime = ''
  const patientId = clip(body?.patient_id, 40)
  if (!ObjectId.isValid(patientId)) throw httpError(400, 'Patient is required')
  const opAmount = money(body?.op_amount)
  const treatmentAmount = money(body?.treatment_amount)
  const otherAmount = money(body?.other_amount)
  const amountPaid = money(body?.amount_paid)
  return {
    patient_id: patientId,
    category: category.id,
    category_label: category.label,
    visit_date: visitDate,
    chief_complaint: clip(body?.chief_complaint, 2000),
    treatment_plan: clip(body?.treatment_plan, 4000),
    treatment_notes: clip(body?.treatment_notes, 4000),
    medicines: normalizeMedicines(body?.medicines, visitDate),
    prescription_notes: clip(body?.prescription_notes, 2000),
    op_amount: opAmount,
    treatment_amount: treatmentAmount,
    other_amount: otherAmount,
    amount_paid: amountPaid,
    billing_notes: clip(body?.billing_notes, 2000),
    assisting_doctor: clip(body?.assisting_doctor, 200),
    next_appointment: nextAppointment,
    appointment_time: appointmentTime
  }
}

router.get('/meta/categories', (_req, res) => {
  res.json({ categories: CATEGORIES })
})

router.get('/upcoming', asyncHandler(async (req, res) => {
  const db = await getDb()
  let days = Number(req.query.days ?? 14)
  if (!Number.isFinite(days) || days < 1) days = 14
  if (days > 365) days = 365
  const from = todayIso()
  const to = addDays(from, days)
  const records = await db.collection('records')
    .find({ next_appointment: { $gte: from, $lte: to } })
    .sort({ next_appointment: 1, appointment_time: 1, created_at: 1 })
    .limit(500)
    .toArray()
  const ids = [...new Set(records.map((record) => record.patient_id))]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id))
  const patients = ids.length
    ? await db.collection('patients').find({ _id: { $in: ids } }).toArray()
    : []
  const byId = new Map(patients.map((patient) => [String(patient._id), patient]))
  const items = records.map((record) => {
    const patient = byId.get(record.patient_id)
    return {
      ...record,
      patient_name: patient?.name || 'Unknown patient',
      patient_mobile: patient?.mobile || '',
      patient_email: patient?.email || '',
      patient_reg_no: patient?.reg_no || ''
    }
  })
  res.json({ days, from, to, records: items })
}))

router.get('/', asyncHandler(async (req, res) => {
  const db = await getDb()
  const filter = {}
  if (req.query.patient_id) {
    const patientId = clip(req.query.patient_id, 40)
    if (!ObjectId.isValid(patientId)) throw httpError(400, 'Invalid patient id')
    filter.patient_id = patientId
  }
  if (req.query.category) {
    const category = categoryById(clip(req.query.category, 80))
    if (!category) throw httpError(400, 'Invalid category')
    filter.category = category.id
  }
  if (req.query.date) {
    const date = clip(req.query.date, 10)
    if (!isIsoDate(date)) throw httpError(400, 'Date must be YYYY-MM-DD')
    filter.visit_date = date
  }
  const records = await db.collection('records')
    .find(filter)
    .sort({ visit_date: -1, created_at: -1 })
    .limit(1000)
    .toArray()
  res.json({ records })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const doc = normalizeRecord(req.body)
  const patient = await db.collection('patients').findOne({ _id: new ObjectId(doc.patient_id) })
  if (!patient) throw httpError(404, 'Patient not found')
  const now = new Date().toISOString()
  const result = await db.collection('records').insertOne({ ...doc, created_at: now, updated_at: now })
  const record = await db.collection('records').findOne({ _id: result.insertedId })
  res.status(201).json({ record })
}))

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const _id = parseId(req.params.id)
  const existing = await db.collection('records').findOne({ _id })
  if (!existing) throw httpError(404, 'Visit not found')
  const doc = normalizeRecord({ ...req.body, patient_id: existing.patient_id })
  await db.collection('records').updateOne({ _id }, {
    $set: { ...doc, updated_at: new Date().toISOString() }
  })
  const record = await db.collection('records').findOne({ _id })
  res.json({ record })
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const _id = parseId(req.params.id)
  const result = await db.collection('records').deleteOne({ _id })
  if (!result.deletedCount) throw httpError(404, 'Visit not found')
  res.json({ ok: true })
}))

export default router
