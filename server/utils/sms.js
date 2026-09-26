import { waNumber } from './reminder.js'

export function msg91Configured() {
  return Boolean(
    process.env.MSG91_AUTH_KEY
    && process.env.MSG91_FLOW_ID
    && process.env.MSG91_SENDER_ID
  )
}

export function indiaMobile(mobile) {
  return waNumber(mobile)
}

export async function sendMsg91Sms({ mobile, variables = {} }) {
  if (!msg91Configured()) {
    throw new Error('Configure MSG91_AUTH_KEY, MSG91_FLOW_ID, and MSG91_SENDER_ID in server/.env')
  }
  const mobiles = indiaMobile(mobile)
  if (!mobiles || mobiles.length < 12) {
    throw new Error('A valid 10-digit Indian mobile number is required')
  }

  const recipient = { mobiles, ...variables }
  const body = {
    template_id: process.env.MSG91_FLOW_ID,
    flow_id: process.env.MSG91_FLOW_ID,
    sender: process.env.MSG91_SENDER_ID,
    short_url: '0',
    recipients: [recipient]
  }

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authkey: process.env.MSG91_AUTH_KEY
    },
    body: JSON.stringify(body)
  })

  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok) {
    throw new Error(data.message || data.type || `MSG91 error (${res.status})`)
  }

  // MSG91 may return 200 with type=error
  if (String(data.type || '').toLowerCase() === 'error') {
    throw new Error(data.message || 'MSG91 rejected the SMS')
  }

  return {
    ok: true,
    mobile: mobiles,
    response: data
  }
}

export function appointmentSmsVariables(patient, record, clinic) {
  const nameKey = process.env.MSG91_VAR_NAME || 'name'
  const dateKey = process.env.MSG91_VAR_DATE || 'date'
  const clinicKey = process.env.MSG91_VAR_CLINIC || 'clinic'
  const phoneKey = process.env.MSG91_VAR_PHONE || 'phone'

  const whenParts = []
  if (record?.next_appointment) {
    const [y, m, d] = String(record.next_appointment).split('-')
    whenParts.push(`${d}/${m}/${y}`)
  }
  if (record?.appointment_time) whenParts.push(String(record.appointment_time).slice(0, 5))

  return {
    [nameKey]: patient?.name || 'Patient',
    [dateKey]: whenParts.join(' ') || 'soon',
    [clinicKey]: clinic?.name || 'Jillet Dental Care',
    [phoneKey]: clinic?.phone || ''
  }
}
