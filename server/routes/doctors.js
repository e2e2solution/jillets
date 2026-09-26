import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler, httpError, clip, digitsOnly } from '../utils/http.js'

const router = Router()
router.use(requireAuth)

router.get('/', asyncHandler(async (_req, res) => {
  const db = await getDb()
  const doctors = await db.collection('doctors').find({}).sort({ name_lower: 1 }).toArray()
  res.json({ doctors })
}))

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  const name = clip(req.body?.name, 200)
  if (!name) throw httpError(400, 'Doctor name is required')
  const doc = {
    name,
    name_lower: name.toLowerCase(),
    specialty: clip(req.body?.specialty, 200),
    phone: digitsOnly(req.body?.phone).slice(0, 15),
    created_at: new Date().toISOString()
  }
  try {
    const result = await db.collection('doctors').insertOne(doc)
    const doctor = await db.collection('doctors').findOne({ _id: result.insertedId })
    res.status(201).json({ doctor })
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'A doctor with this name already exists')
    throw err
  }
}))

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const db = await getDb()
  if (!ObjectId.isValid(req.params.id)) throw httpError(400, 'Invalid id')
  const result = await db.collection('doctors').deleteOne({ _id: new ObjectId(req.params.id) })
  if (!result.deletedCount) throw httpError(404, 'Doctor not found')
  res.json({ ok: true })
}))

export default router
