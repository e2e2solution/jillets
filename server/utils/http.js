export function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function clip(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max)
}

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
}
