import nodemailer from 'nodemailer'
import { clinicInfo, smtpConfigured } from './constants.js'

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function createMailTransport() {
  if (!smtpConfigured()) {
    throw new Error('Configure SMTP in server/.env')
  }
  const port = Number(process.env.SMTP_PORT || 587)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || '').replace(/\s+/g, '')
    }
  })
}

export async function sendClinicMail({ to, subject, text }) {
  if (!isValidEmail(to)) throw new Error('A valid patient email is required')
  const clinic = clinicInfo()
  const transporter = createMailTransport()
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: String(to).trim().toLowerCase(),
    subject: subject || `Appointment reminder — ${clinic.name}`,
    text
  })
  return {
    ok: true,
    to: String(to).trim().toLowerCase(),
    messageId: info.messageId || ''
  }
}
