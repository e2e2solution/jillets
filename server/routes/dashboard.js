import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db/mongo.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { CATEGORIES } from '../utils/constants.js'
import { asyncHandler, httpError, clip } from '../utils/http.js'

const router = Router()
router.use(requireAuth)
router.use(requireRole('admin', 'owner'))

function money(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function monthKey(isoDate) {
  return String(isoDate || '').slice(0, 7)
}

function yearOf(isoDate) {
  return String(isoDate || '').slice(0, 4)
}

router.get('/revenue', asyncHandler(async (req, res) => {
  const db = await getDb()
  const now = new Date()
  let year = Number(req.query.year || now.getFullYear())
  if (!Number.isFinite(year) || year < 2000 || year > 2100) year = now.getFullYear()
  const monthRaw = clip(req.query.month, 2)
  const month = monthRaw ? Number(monthRaw) : null
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    throw httpError(400, 'Month must be 1-12')
  }

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const records = await db.collection('records')
    .find({ visit_date: { $gte: yearStart, $lte: yearEnd } })
    .project({
      patient_id: 1,
      category: 1,
      category_label: 1,
      visit_date: 1,
      op_amount: 1,
      treatment_amount: 1,
      other_amount: 1,
      amount_paid: 1,
      assisting_doctor: 1
    })
    .toArray()

  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    return {
      key,
      label: key,
      month: i + 1,
      op: 0,
      treatment: 0,
      other: 0,
      billed: 0,
      paid: 0,
      visits: 0
    }
  })
  const byMonth = new Map(months.map((item) => [item.key, item]))

  const categoryYear = CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    op: 0,
    treatment: 0,
    other: 0,
    billed: 0,
    paid: 0,
    visits: 0
  }))
  const categoryYearMap = new Map(categoryYear.map((item) => [item.id, item]))

  const categoryMonth = CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    op: 0,
    treatment: 0,
    other: 0,
    billed: 0,
    paid: 0,
    visits: 0
  }))
  const categoryMonthMap = new Map(categoryMonth.map((item) => [item.id, item]))
  const selectedMonthKey = month ? `${year}-${String(month).padStart(2, '0')}` : null

  const patientPaid = new Map()

  let yearTotals = { op: 0, treatment: 0, other: 0, billed: 0, paid: 0, visits: 0 }
  let monthTotals = { op: 0, treatment: 0, other: 0, billed: 0, paid: 0, visits: 0 }

  for (const record of records) {
    const op = money(record.op_amount)
    const treatment = money(record.treatment_amount)
    const other = money(record.other_amount)
    const paid = money(record.amount_paid)
    const billed = money(op + treatment + other)
    const key = monthKey(record.visit_date)
    const bucket = byMonth.get(key)
    if (bucket) {
      bucket.op += op
      bucket.treatment += treatment
      bucket.other += other
      bucket.billed += billed
      bucket.paid += paid
      bucket.visits += 1
    }

    yearTotals = {
      op: yearTotals.op + op,
      treatment: yearTotals.treatment + treatment,
      other: yearTotals.other + other,
      billed: yearTotals.billed + billed,
      paid: yearTotals.paid + paid,
      visits: yearTotals.visits + 1
    }

    const catYear = categoryYearMap.get(record.category)
    if (catYear) {
      catYear.op += op
      catYear.treatment += treatment
      catYear.other += other
      catYear.billed += billed
      catYear.paid += paid
      catYear.visits += 1
    } else {
      let extra = categoryYearMap.get('other')
      if (!extra) {
        extra = {
          id: 'other',
          label: 'Other',
          op: 0,
          treatment: 0,
          other: 0,
          billed: 0,
          paid: 0,
          visits: 0
        }
        categoryYear.push(extra)
        categoryYearMap.set('other', extra)
      }
      extra.op += op
      extra.treatment += treatment
      extra.other += other
      extra.billed += billed
      extra.paid += paid
      extra.visits += 1
    }

    if (selectedMonthKey && key === selectedMonthKey) {
      monthTotals = {
        op: monthTotals.op + op,
        treatment: monthTotals.treatment + treatment,
        other: monthTotals.other + other,
        billed: monthTotals.billed + billed,
        paid: monthTotals.paid + paid,
        visits: monthTotals.visits + 1
      }
      const catMonth = categoryMonthMap.get(record.category) || categoryMonthMap.get('other')
      if (catMonth) {
        catMonth.op += op
        catMonth.treatment += treatment
        catMonth.other += other
        catMonth.billed += billed
        catMonth.paid += paid
        catMonth.visits += 1
      }
    }

    if (!patientPaid.has(record.patient_id)) {
      patientPaid.set(record.patient_id, {
        patient_id: record.patient_id,
        billed: 0,
        paid: 0,
        visits: 0
      })
    }
    const patientRow = patientPaid.get(record.patient_id)
    patientRow.billed += billed
    patientRow.paid += paid
    patientRow.visits += 1
  }

  const patientIds = [...patientPaid.keys()]
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id))
  const patients = patientIds.length
    ? await db.collection('patients').find({ _id: { $in: patientIds } }).toArray()
    : []
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]))

  const patientPayments = [...patientPaid.values()]
    .map((row) => {
      const patient = patientMap.get(row.patient_id)
      return {
        ...row,
        name: patient?.name || 'Unknown patient',
        reg_no: patient?.reg_no || '',
        mobile: patient?.mobile || '',
        category_label: patient?.category_label || '',
        balance: money(row.billed - row.paid)
      }
    })
    .sort((a, b) => b.paid - a.paid)

  const availableYears = [...new Set(
    (await db.collection('records').distinct('visit_date'))
      .map((date) => yearOf(date))
      .filter(Boolean)
  )].sort()
  if (!availableYears.includes(String(year))) availableYears.push(String(year))
  availableYears.sort()

  res.json({
    year,
    month,
    year_totals: yearTotals,
    month_totals: month ? monthTotals : null,
    monthly: months,
    categories_year: categoryYear,
    categories_month: month ? categoryMonth : [],
    patients: patientPayments,
    available_years: availableYears.map(Number)
  })
}))

export default router
