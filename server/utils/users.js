import { getDb } from '../db/mongo.js'

const ROLES = ['admin', 'owner']

export function isValidRole(role) {
  return ROLES.includes(role)
}

export async function ensureUsers() {
  const db = await getDb()
  await db.collection('users').createIndex({ username: 1 }, { unique: true, name: 'username_unique' })
  const count = await db.collection('users').countDocuments()
  if (count > 0) return

  const now = new Date().toISOString()
  await db.collection('users').insertMany([
    {
      username: process.env.AUTH_USERNAME || 'admin',
      password: process.env.AUTH_PASSWORD || 'jillet123',
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
  ])
  console.log('Seeded MongoDB users: admin (clinic) and owner (dashboard)')
}

export async function findUserByUsername(username) {
  const db = await getDb()
  return db.collection('users').findOne({
    username: String(username || '').trim(),
    active: { $ne: false }
  })
}

export async function verifyUser(username, password) {
  const user = await findUserByUsername(username)
  if (!user) return null
  if (String(user.password) !== String(password)) return null
  return {
    username: user.username,
    role: isValidRole(user.role) ? user.role : 'admin',
    name: user.name || user.username
  }
}
