export const CATEGORIES = [
  { id: 'conservative_endodontics', label: 'Conservative dentistry & endodontics' },
  { id: 'prosthodontics', label: 'Prosthodontics' },
  { id: 'oral_maxillofacial_surgery', label: 'Oral & maxillofacial surgery' },
  { id: 'pedodontics', label: 'Pedodontics' },
  { id: 'periodontics', label: 'Periodontics' },
  { id: 'orthodontics', label: 'Orthodontics' },
  { id: 'oral_pathology_medicine', label: 'Oral pathology & oral medicine' }
]

export const MEDICAL_HISTORY_KEYS = [
  'diabetic',
  'hypertension',
  'heart_disease',
  'epilepsy',
  'allergy',
  'asthma',
  'pregnancy',
  'lactation'
]

export function clinicInfo() {
  return {
    name: process.env.CLINIC_NAME || 'Jillet Dental Care',
    phone: process.env.CLINIC_PHONE || '91 95678 02796',
    location: process.env.CLINIC_LOCATION || 'Pallikkara'
  }
}

export function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id) || null
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function msg91Configured() {
  return Boolean(
    process.env.MSG91_AUTH_KEY
    && process.env.MSG91_FLOW_ID
    && process.env.MSG91_SENDER_ID
  )
}
