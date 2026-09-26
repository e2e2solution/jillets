import { clinicInfo } from './constants.js'

export function formatDisplayDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function formatWhen(date, time) {
  const shown = formatDisplayDate(date)
  if (!shown) return ''
  const hhmm = time ? String(time).slice(0, 5) : ''
  return hhmm ? `${shown} at ${hhmm}` : shown
}

export function waNumber(mobile) {
  let digits = String(mobile || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return digits
}

export function buildReminderMessage(patient, record) {
  const clinic = clinicInfo()
  const when = record?.next_appointment
    ? formatWhen(record.next_appointment, record.appointment_time)
    : ''
  const lines = [
    `Hello ${patient.name},`,
    '',
    `This is a reminder from *${clinic.name}* (${clinic.location}).`,
    ''
  ]
  if (when) {
    lines.push(`Your next dental appointment is on *${when}*.`)
  } else {
    lines.push('Please contact us to confirm your next visit.')
  }
  if (record?.category_label) lines.push(`Department: ${record.category_label}`)
  if (record?.assisting_doctor) lines.push(`Doctor: ${record.assisting_doctor}`)
  lines.push(
    '',
    'Please arrive 10 minutes early. Reply to confirm your visit.',
    `Call us: ${clinic.phone}`,
    '',
    'Thank you,',
    clinic.name
  )
  return lines.join('\n')
}

export function buildWaLink(mobile, message) {
  const number = waNumber(mobile)
  if (!number) return ''
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
