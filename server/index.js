import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { mongoOk, getDb } from './db/mongo.js'
import { clinicInfo, smtpConfigured, msg91Configured } from './utils/constants.js'
import { ensureUsers } from './utils/users.js'
import { startAppointmentReminderJob } from './jobs/appointmentReminders.js'
import authRoutes from './routes/auth.js'
import patientRoutes from './routes/patients.js'
import recordRoutes from './routes/records.js'
import doctorRoutes from './routes/doctors.js'
import reminderRoutes from './routes/reminders.js'
import dashboardRoutes from './routes/dashboard.js'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT || 3002)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_req, res) => {
  const mongo = await mongoOk()
  res.json({
    ok: true,
    mongo,
    clinic: clinicInfo(),
    smtp: smtpConfigured(),
    msg91: msg91Configured()
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/doctors', doctorRoutes)
app.use('/api/reminders', reminderRoutes)
app.use('/api/dashboard', dashboardRoutes)

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../client/dist')
  app.use(express.static(dist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err, _req, res, _next) => {
  const status = err.status || 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Server error' : err.message })
})

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Set it in server/.env')
  process.exit(1)
}

app.listen(PORT, async () => {
  console.log(`Jillet Dental API listening on http://localhost:${PORT}`)
  try {
    await getDb()
    await ensureUsers()
    startAppointmentReminderJob()
  } catch (err) {
    console.error('Startup DB seed:', err.message)
  }
})
