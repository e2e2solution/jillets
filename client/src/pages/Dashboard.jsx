import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { formatInr } from '../constants'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function BarChart({ items, valueKey = 'paid', labelKey = 'label' }) {
  const max = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1)
  return (
    <div className="bars">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0
        const height = Math.max(4, Math.round((value / max) * 140))
        return (
          <div key={item[labelKey] || item.id || item.key} className="bar-col" title={`${item[labelKey]}: ${formatInr(value)}`}>
            <div className="bar" style={{ height: `${height}px` }} />
            <span>{item.short || item[labelKey]}</span>
            <small>{formatInr(value)}</small>
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api(`/api/dashboard/revenue?year=${year}&month=${month}`)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [year, month])

  const monthlyBars = useMemo(() => (
    (data?.monthly || []).map((item) => ({
      ...item,
      short: MONTH_NAMES[item.month - 1],
      label: MONTH_NAMES[item.month - 1]
    }))
  ), [data])

  const categoryYearBars = useMemo(() => (
    (data?.categories_year || [])
      .filter((item) => item.paid > 0 || item.billed > 0)
      .map((item) => ({
        ...item,
        short: item.label.split(' ')[0],
        label: item.label
      }))
  ), [data])

  const categoryMonthBars = useMemo(() => (
    (data?.categories_month || [])
      .filter((item) => item.paid > 0 || item.billed > 0)
      .map((item) => ({
        ...item,
        short: item.label.split(' ')[0],
        label: item.label
      }))
  ), [data])

  const years = data?.available_years?.length
    ? data.available_years
    : [now.getFullYear()]

  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Owner dashboard</p>
          <h1>Revenue & payments</h1>
          <p className="muted">Month-wise and yearly totals for the clinic. Internal accounts only.</p>
        </div>
        <div className="row-actions">
          <label className="inline-field">
            Year
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {years.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Month
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading || !data ? <p className="muted">Loading dashboard…</p> : (
        <>
          <div className="stat-grid">
            <article className="stat-card">
              <p>Year paid ({year})</p>
              <strong>{formatInr(data.year_totals.paid)}</strong>
              <small>Billed {formatInr(data.year_totals.billed)} · {data.year_totals.visits} visits</small>
            </article>
            <article className="stat-card">
              <p>Month paid ({MONTH_NAMES[month - 1]})</p>
              <strong>{formatInr(data.month_totals?.paid || 0)}</strong>
              <small>Billed {formatInr(data.month_totals?.billed || 0)} · {data.month_totals?.visits || 0} visits</small>
            </article>
            <article className="stat-card">
              <p>Year balance</p>
              <strong>{formatInr((data.year_totals.billed || 0) - (data.year_totals.paid || 0))}</strong>
              <small>OP {formatInr(data.year_totals.op)} · Tx {formatInr(data.year_totals.treatment)} · Other {formatInr(data.year_totals.other)}</small>
            </article>
          </div>

          <div className="dash-grid">
            <article className="panel">
              <h2>Paid amount by month · {year}</h2>
              <BarChart items={monthlyBars} valueKey="paid" />
            </article>
            <article className="panel">
              <h2>Paid by category · {year}</h2>
              {categoryYearBars.length === 0 ? <p className="muted">No payments this year.</p> : (
                <BarChart items={categoryYearBars} valueKey="paid" />
              )}
            </article>
            <article className="panel">
              <h2>Paid by category · {MONTH_NAMES[month - 1]} {year}</h2>
              {categoryMonthBars.length === 0 ? <p className="muted">No payments this month.</p> : (
                <BarChart items={categoryMonthBars} valueKey="paid" />
              )}
            </article>
            <article className="panel">
              <h2>Category totals · {year}</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>OP</th>
                      <th>Treatment</th>
                      <th>Other</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories_year.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Category">{row.label}</td>
                        <td data-label="OP">{formatInr(row.op)}</td>
                        <td data-label="Treatment">{formatInr(row.treatment)}</td>
                        <td data-label="Other">{formatInr(row.other)}</td>
                        <td data-label="Billed">{formatInr(row.billed)}</td>
                        <td data-label="Paid">{formatInr(row.paid)}</td>
                        <td data-label="Visits">{row.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <section className="panel tracker">
            <div className="page-head">
              <div>
                <h2>Each customer · paid in {year}</h2>
                <p className="muted">Open a patient to see visit-wise OP, treatment, other, and amount taken.</p>
              </div>
            </div>
            {data.patients.length === 0 ? <p className="muted">No billed visits this year.</p> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Reg.</th>
                      <th>Category</th>
                      <th>Visits</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.patients.map((row) => (
                      <tr key={row.patient_id}>
                        <td data-label="Patient">{row.name}</td>
                        <td data-label="Reg.">{row.reg_no || '—'}</td>
                        <td data-label="Category">{row.category_label || '—'}</td>
                        <td data-label="Visits">{row.visits}</td>
                        <td data-label="Billed">{formatInr(row.billed)}</td>
                        <td data-label="Paid">{formatInr(row.paid)}</td>
                        <td data-label="Balance">{formatInr(row.balance)}</td>
                        <td data-label="Open">
                          <Link className="btn small" to={`/patients/${row.patient_id}`}>Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}
