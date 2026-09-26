import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { MEDICAL_HISTORY_KEYS, categoryById, clinicInfo } from '../utils/constants.js'
import { asyncHandler, httpError, escapeRegex, clip, digitsOnly, isIsoDate } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

function parseId(id) {
  if (!ObjectId.isValid(id)) throw httpError(400, 'Invalid id')
  return new ObjectId(id)
}

function normalizeHistory(input) {
  const source = input && typeof input === 'object' ? input : {}
  const history = {}
  for (const key of MEDICAL_HISTORY_KEYS) history[key] = Boolean(source[key])
  return history
}

function normalizePatient(body, existing = null) {
  const name = clip(body?.name, 200)
  if (!name) throw httpError(400, 'Patient name is required')
  const genderRaw = clip(body?.gender, 8).toUpperCase()
  const gender = ['M', 'F', 'O'].includes(genderRaw) ? genderRaw : ''
  let age = null
  if (body?.age !== '' && body?.age !== null && body?.age !== undefined) {
    const parsed = Number(body.age)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 150 || Math.floor(parsed) !== parsed) {
      throw httpError(400, 'Age must be a whole number from 0 to 150')
    }
    age = parsed
  }
  const regDate = clip(body?.reg_date, 10)
  if (regDate && !isIsoDate(regDate)) throw httpError(400, 'Registration date must be YYYY-MM-DD')
  const regNo = clip(body?.reg_no, 40)
  let category = categoryById(clip(body?.category, 80))
  if (!category && existing?.category) category = categoryById(existing.category)
  if (!category) throw httpError(400, 'A treatment category is required')
  const email = clip(body?.email, 200).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'Enter a valid patient email address')
  }
  const doc = {
    name,
    name_lower: name.toLowerCase(),
    age,
    gender,
    address: clip(body?.address, 500),
    mobile: digitsOnly(body?.mobile).slice(0, 15),
    email,
    reg_date: regDate,
    category: category.id,
    category_label: category.label,
    medical_history: normalizeHistory(body?.medical_history),
    medication_details: clip(body?.medication_details, 2000),
    notes: clip(body?.notes, 4000)
  }
  if (regNo) doc.reg_no = regNo
  return doc
}

async function idsForVisitDate(db, visitDate) {
  const ids = await db.collection('records').distinct('patient_id', { visit_date: visitDate })
  return ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
}

router.get('/', asyncHandler(async (req, res) => {
  const db = await getDb()
  const q = clip(req.query.q, 80)
  const mobile = digitsOnly(req.query.mobile).slice(0, 15)
  const date = clip(req.query.date, 10)
  const from = clip(req.query.from, 10)
  const to = clip(req.query.to, 10)
  const category = clip(req.query.category, 80)
  if (date && !isIsoDate(date)) throw httpError(400, 'Date must be YYYY-MM-DD')
  if (from && !isIsoDate(from)) throw httpError(400, 'From date must be YYYY-MM-DD')
  if (to && !isIsoDate(to)) throw httpError(400, 'To date must be YYYY-MM-DD')

  const and = []
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    and.push({ $or: [{ name: rx }, { mobile: rx }, { reg_no: rx }] })
  }
  if (mobile) and.push({ mobile: new RegExp(escapeRegex(mobile)) })
  if (category) {
    const match = categoryById(category)
    if (!match) throw httpError(400, 'Invalid category')
    and.push({ category: match.id })
  }
  if (date) {
    const ids = await idsForVisitDate(db, date)
    and.push({ $or: [{ reg_date: date }, { _id: { $in: ids } }] })
  }
  if (from || to) {
    const range = {}
    if (from) range.$gte = from
    if (to) range.$lte = to
    const ids = await idsForVisitDate(db, range)
    and.push({ $or: [{ reg_date: range }, { _id: { $in: ids } }] })
  }

  const filter = and.length ? { $and: and } : {}
  const patients = await db.collection('patients')
    .find(filter)
    .sort({ name_lower: 1, reg_no: 1 })
    .limit(1000)
    .toArray()
  res.json({ patients })
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const db = await getDb()
  const _id = parseId(req.params.id)
  const patient = await db.collection('patients').findOne({ _id })
  if (!patient) throw httpError(404, 'Patient not found')
  const records = await db.collection('records')
    .find({ patient_id: String(patient._id) })
    .sort({ visit_date: -1, created_at: -1 })
    .toArray()
  res.json({ patient, records, clinic: clinicInfo() })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const now = new Date().toISOString()
  const doc = { ...normalizePatient(req.body), created_at: now, updated_at: now }
  try {
    const result = await db.collection('patients').insertOne(doc)
    const patient = await db.collection('patients').findOne({ _id: result.insertedId })
    res.status(201).json({ patient })
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'Registration number already exists')
    throw err
  }
}))

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const _id = parseId(req.params.id)
  const existing = await db.collection('patients').findOne({ _id })
  if (!existing) throw httpError(404, 'Patient not found')
  const doc = { ...normalizePatient(req.body, existing), updated_at: new Date().toISOString() }
  const update = { $set: doc }
  if (!doc.reg_no) update.$unset = { reg_no: '' }
  try {
    await db.collection('patients').updateOne({ _id }, update)
    const patient = await db.collection('patients').findOne({ _id })
    res.json({ patient })
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'Registration number already exists')
    throw err
  }
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const _id = parseId(req.params.id)
  const existing = await db.collection('patients').findOne({ _id })
  if (!existing) throw httpError(404, 'Patient not found')
  await db.collection('records').deleteMany({ patient_id: String(_id) })
  await db.collection('patients').deleteOne({ _id })
  res.json({ ok: true })
}))

export default router
