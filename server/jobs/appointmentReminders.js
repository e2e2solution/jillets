import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { clinicInfo, smtpConfigured } from '../utils/constants.js'
import { isValidEmail, sendClinicMail } from '../utils/mail.js'
import { buildReminderMessage } from '../utils/reminder.js'
import { appointmentSmsVariables, indiaMobile, msg91Configured, sendMsg91Sms } from '../utils/sms.js'

function todayIso(base = new Date()) {
  const month = String(base.getMonth() + 1).padStart(2, '0')
  const day = String(base.getDate()).padStart(2, '0')
  return `${base.getFullYear()}-${month}-${day}`
}

function addDaysIso(days, base = new Date()) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  date.setDate(date.getDate() + days)
  return todayIso(date)
}

const KINDS = [
  { kind: '5day', days: 5, label: '5 days before' },
  { kind: '1day', days: 1, label: '1 day before' }
]

async function ensureReminderIndexes(db) {
  await Promise.all([
    db.collection('email_reminders').createIndex(
      { record_id: 1, appointment_date: 1, kind: 1 },
      { unique: true, name: 'reminder_unique' }
    ),
    db.collection('sms_reminders').createIndex(
      { record_id: 1, appointment_date: 1, kind: 1 },
      { unique: true, name: 'sms_reminder_unique' }
    )
  ])
}

async function loadDueAppointments(db, appointmentDate) {
  const records = await db.collection('records')
    .find({ next_appointment: appointmentDate })
    .toArray()
  const items = []
  for (const record of records) {
    if (!ObjectId.isValid(record.patient_id)) continue
    const patient = await db.collection('patients').findOne({ _id: new ObjectId(record.patient_id) })
    if (!patient) continue
    items.push({ record, patient })
  }
  return items
}

async function sendDueEmails(db, clinic) {
  if (!smtpConfigured()) {
    return { ok: false, reason: 'smtp_missing', sent: 0, skipped: 0, details: [] }
  }

  let sent = 0
  let skipped = 0
  const details = []

  for (const item of KINDS) {
    const appointmentDate = addDaysIso(item.days)
    const due = await loadDueAppointments(db, appointmentDate)

    for (const { record, patient } of due) {
      if (!isValidEmail(patient.email)) {
        skipped += 1
        details.push({ channel: 'email', kind: item.kind, record_id: String(record._id), status: 'skipped_no_patient_email' })
        continue
      }

      const already = await db.collection('email_reminders').findOne({
        record_id: String(record._id),
        appointment_date: appointmentDate,
        kind: item.kind
      })
      if (already) {
        skipped += 1
        continue
      }

      const text = buildReminderMessage(patient, record)
      const subject = `${item.label === '1 day before' ? 'Tomorrow' : 'Upcoming'} appointment — ${clinic.name}`

      try {
        const mail = await sendClinicMail({ to: patient.email, subject, text })
        await db.collection('email_reminders').insertOne({
          record_id: String(record._id),
          patient_id: String(patient._id),
          patient_email: mail.to,
          appointment_date: appointmentDate,
          kind: item.kind,
          days_before: item.days,
          subject,
          sent_at: new Date().toISOString(),
          message_id: mail.messageId
        })
        sent += 1
        details.push({ channel: 'email', kind: item.kind, record_id: String(record._id), to: mail.to, status: 'sent' })
      } catch (err) {
        console.error('Appointment email failed:', err.message)
        details.push({ channel: 'email', kind: item.kind, record_id: String(record._id), to: patient.email, status: 'error', error: err.message })
      }
    }
  }

  return { ok: true, sent, skipped, details }
}

async function sendDueSms(db, clinic) {
  if (!msg91Configured()) {
    return { ok: false, reason: 'msg91_missing', sent: 0, skipped: 0, details: [] }
  }

  let sent = 0
  let skipped = 0
  const details = []

  for (const item of KINDS) {
    const appointmentDate = addDaysIso(item.days)
    const due = await loadDueAppointments(db, appointmentDate)

    for (const { record, patient } of due) {
      const mobile = indiaMobile(patient.mobile)
      if (!mobile || mobile.length < 12) {
        skipped += 1
        details.push({ channel: 'sms', kind: item.kind, record_id: String(record._id), status: 'skipped_no_patient_mobile' })
        continue
      }

      const already = await db.collection('sms_reminders').findOne({
        record_id: String(record._id),
        appointment_date: appointmentDate,
        kind: item.kind
      })
      if (already) {
        skipped += 1
        continue
      }

      try {
        const sms = await sendMsg91Sms({
          mobile: patient.mobile,
          variables: appointmentSmsVariables(patient, record, clinic)
        })
        await db.collection('sms_reminders').insertOne({
          record_id: String(record._id),
          patient_id: String(patient._id),
          patient_mobile: sms.mobile,
          appointment_date: appointmentDate,
          kind: item.kind,
          days_before: item.days,
          sent_at: new Date().toISOString(),
          provider: 'msg91',
          response: sms.response || {}
        })
        sent += 1
        details.push({ channel: 'sms', kind: item.kind, record_id: String(record._id), to: sms.mobile, status: 'sent' })
      } catch (err) {
        console.error('Appointment SMS failed:', err.message)
        details.push({ channel: 'sms', kind: item.kind, record_id: String(record._id), to: mobile, status: 'error', error: err.message })
      }
    }
  }

  return { ok: true, sent, skipped, details }
}

export async function runAppointmentEmailReminders() {
  const db = await getDb()
  await ensureReminderIndexes(db)
  const clinic = clinicInfo()
  const email = await sendDueEmails(db, clinic)
  console.log(`Appointment email job finished: sent=${email.sent}, skipped=${email.skipped}`)
  return email
}

export async function runAppointmentReminders() {
  const db = await getDb()
  await ensureReminderIndexes(db)
  const clinic = clinicInfo()
  const email = await sendDueEmails(db, clinic)
  const sms = await sendDueSms(db, clinic)
  console.log(`Appointment reminders finished: email sent=${email.sent} skipped=${email.skipped}; sms sent=${sms.sent} skipped=${sms.skipped}`)
  return {
    ok: true,
    email,
    sms
  }
}

export function startAppointmentReminderJob() {
  const hours = Number(process.env.REMINDER_JOB_HOURS || 24)
  const ms = Math.max(1, hours) * 60 * 60 * 1000

  const tick = () => {
    runAppointmentReminders().catch((err) => {
      console.error('Appointment reminder job error:', err.message)
    })
  }

  setTimeout(tick, 15_000)
  setInterval(tick, ms)
  console.log(`Appointment reminder job scheduled every ${hours} hour(s) (email + MSG91 SMS; 5-day + 1-day)`)
}
