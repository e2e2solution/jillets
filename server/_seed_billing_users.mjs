import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { ensureUsers } from './utils/users.js'

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'jillet_dental')

// ensureUsers uses getDb from mongo module which needs connection via connectDb
// Call users seed directly here instead
await db.collection('users').createIndex({ username: 1 }, { unique: true })
const now = new Date().toISOString()
const users = [
  {
    username: 'admin',
    password: 'jillet123',
    role: 'admin',
    name: 'Clinic Admin',
    active: true,
    created_at: now,
    updated_at: now
  },
  {
    username: 'owner',
    password: 'owner123',
    role: 'owner',
    name: 'Clinic Owner',
    active: true,
    created_at: now,
    updated_at: now
  }
]
for (const user of users) {
  await db.collection('users').updateOne(
    { username: user.username },
    { $set: user },
    { upsert: true }
  )
}

const billingByReg = {
  '2340': [
    { op_amount: 200, treatment_amount: 1500, other_amount: 100, amount_paid: 1800, billing_notes: 'Cash + UPI' },
    { op_amount: 0, treatment_amount: 300, other_amount: 0, amount_paid: 300, billing_notes: 'Review fee' }
  ],
  '2341': [
    { op_amount: 250, treatment_amount: 4000, other_amount: 500, amount_paid: 2500, billing_notes: 'Advance for FPD' }
  ],
  '2342': [
    { op_amount: 200, treatment_amount: 800, other_amount: 0, amount_paid: 1000, billing_notes: 'Wire change' }
  ],
  '2343': [
    { op_amount: 150, treatment_amount: 2500, other_amount: 200, amount_paid: 2850, billing_notes: 'Full paid' }
  ],
  '2344': [
    { op_amount: 200, treatment_amount: 1800, other_amount: 150, amount_paid: 1500, billing_notes: 'Partial — balance next visit' }
  ],
  '2345': [
    { op_amount: 300, treatment_amount: 5500, other_amount: 400, amount_paid: 6200, billing_notes: 'Surgical extraction paid' }
  ],
  '2346': [
    { op_amount: 200, treatment_amount: 600, other_amount: 100, amount_paid: 900, billing_notes: 'Consult + medicines' }
  ]
}

const patients = await db.collection('patients').find({}).toArray()
let updated = 0
for (const patient of patients) {
  const packs = billingByReg[patient.reg_no] || []
  const records = await db.collection('records')
    .find({ patient_id: String(patient._id) })
    .sort({ visit_date: 1 })
    .toArray()
  for (let i = 0; i < records.length; i += 1) {
    const bill = packs[i] || {
      op_amount: 200,
      treatment_amount: 1000,
      other_amount: 0,
      amount_paid: 1200,
      billing_notes: 'Dummy billing'
    }
    await db.collection('records').updateOne(
      { _id: records[i]._id },
      { $set: bill }
    )
    updated += 1
  }
}

console.log(JSON.stringify({ users: users.map((u) => ({ username: u.username, role: u.role, password: u.password })), billed_visits: updated }, null, 2))
await client.close()
