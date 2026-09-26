import { MongoClient } from 'mongodb'

let client
let db
let connecting

async function ensureIndexes(database) {
  const jobs = [
    database.collection('patients').createIndex({ reg_no: 1 }, { unique: true, sparse: true, name: 'reg_no_unique' }),
    database.collection('patients').createIndex({ mobile: 1 }, { name: 'mobile' }),
    database.collection('patients').createIndex({ name_lower: 1 }, { name: 'name_lower' }),
    database.collection('patients').createIndex({ reg_date: 1 }, { name: 'reg_date' }),
    database.collection('patients').createIndex({ category: 1 }, { name: 'category' }),
    database.collection('records').createIndex({ patient_id: 1, visit_date: -1 }, { name: 'patient_visit' }),
    database.collection('records').createIndex({ category: 1, visit_date: -1 }, { name: 'category_visit' }),
    database.collection('records').createIndex({ next_appointment: 1 }, { name: 'next_appointment' }),
    database.collection('records').createIndex({ visit_date: 1 }, { name: 'visit_date' }),
    database.collection('doctors').createIndex({ name_lower: 1 }, { unique: true, name: 'doctor_name_unique' }),
    database.collection('users').createIndex({ username: 1 }, { unique: true, name: 'username_unique' })
  ]
  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Index setup:', result.reason?.message || result.reason)
    }
  }
}

export function connectDb() {
  if (db) return Promise.resolve(db)
  if (!connecting) {
    connecting = (async () => {
      const uri = process.env.MONGODB_URI
      if (!uri) throw new Error('MONGODB_URI is not set')
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })
      await client.connect()
      const database = client.db(process.env.MONGODB_DB || 'jillet_dental')
      await ensureIndexes(database)
      db = database
      return db
    })().catch((err) => {
      connecting = null
      db = null
      client = null
      throw err
    })
  }
  return connecting
}

export function getDb() {
  return connectDb()
}

export async function mongoOk() {
  try {
    const database = await getDb()
    await database.command({ ping: 1 })
    return true
  } catch (err) {
    console.error('MongoDB:', err.message)
    return false
  }
}
