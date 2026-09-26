import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { clinicInfo, smtpConfigured } from '../utils/constants.js'
import { asyncHandler, httpError, clip } from '../utils/http.js'
import { isValidEmail, sendClinicMail } from '../utils/mail.js'
import { buildReminderMessage, buildWaLink } from '../utils/reminder.js'
import { runAppointmentReminders } from '../jobs/appointmentReminders.js'
import { appointmentSmsVariables, msg91Configured, sendMsg91Sms } from '../utils/sms.js'

const router = Router()
router.use(requireAuth)

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

async function loadContext(patientId, recordId) {
  if (!ObjectId.isValid(patientId || '')) throw httpError(400, 'Patient is required')
  const db = await getDb()
  const patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) })
  if (!patient) throw httpError(404, 'Patient not found')
  const patientKey = String(patient._id)
  let record = null
  if (recordId) {
    if (!ObjectId.isValid(recordId)) throw httpError(400, 'Invalid visit id')
    record = await db.collection('records').findOne({
      _id: new ObjectId(recordId),
      patient_id: patientKey
    })
    if (!record) throw httpError(404, 'Visit not found')
  } else {
    record = await db.collection('records').find({
      patient_id: patientKey,
      next_appointment: { $gte: todayIso() }
    }).sort({ next_appointment: 1 }).limit(1).next()
    if (!record) {
      record = await db.collection('records')
        .find({ patient_id: patientKey })
        .sort({ visit_date: -1 })
        .limit(1)
        .next()
    }
  }
  return { patient, record }
}

router.post('/whatsapp-template', requireRole('admin'), asyncHandler(async (req, res) => {
  const { patient, record } = await loadContext(req.body?.patient_id, req.body?.record_id)
  const message = buildReminderMessage(patient, record)
  const mobile = patient.mobile || ''
  res.json({
    message,
    wa_link: buildWaLink(mobile, message),
    mobile,
    msg91: msg91Configured()
  })
}))

router.post('/email', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!smtpConfigured()) throw httpError(400, 'Configure SMTP in server/.env')
  const { patient, record } = await loadContext(req.body?.patient_id, req.body?.record_id)
  const to = clip(patient.email, 200).toLowerCase()
  if (!isValidEmail(to)) {
    throw httpError(400, 'Add the patient email on their profile before sending a reminder')
  }
  const clinic = clinicInfo()
  const subject = clip(req.body?.subject, 200) || `Appointment reminder — ${clinic.name}`
  const text = typeof req.body?.body === 'string' && req.body.body.trim()
    ? clip(req.body.body, 8000)
    : buildReminderMessage(patient, record)
  const result = await sendClinicMail({ to, subject, text })
  res.json({ ok: true, to: result.to })
}))

router.post('/sms', requireRole('admin'), asyncHandler(async (req, res) => {
  if (!msg91Configured()) {
    throw httpError(400, 'Configure MSG91_AUTH_KEY, MSG91_FLOW_ID, and MSG91_SENDER_ID in server/.env')
  }
  const { patient, record } = await loadContext(req.body?.patient_id, req.body?.record_id)
  if (!patient.mobile) {
    throw httpError(400, 'Add the patient mobile number on their profile before sending SMS')
  }
  const clinic = clinicInfo()
  const result = await sendMsg91Sms({
    mobile: patient.mobile,
    variables: appointmentSmsVariables(patient, record, clinic)
  })
  res.json({ ok: true, mobile: result.mobile })
}))

router.post('/run-auto', requireRole('admin'), asyncHandler(async (_req, res) => {
  const result = await runAppointmentReminders()
  res.json(result)
}))

export default router
