import { useState } from 'react'
import { api } from '../api'
import { CLINIC } from '../constants'

export default function ReminderActions({ patientId, recordId, email, compact = false }) {
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [wa, setWa] = useState(null)
  const [mailOpen, setMailOpen] = useState(false)
  const [mail, setMail] = useState({ subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [msg91, setMsg91] = useState(false)

  async function copyReminder() {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const data = await api('/api/reminders/whatsapp-template', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, record_id: recordId || undefined })
      })
      setWa(data)
      setMsg91(Boolean(data.msg91))
      try {
        await navigator.clipboard.writeText(data.message)
        setNotice('Reminder copied to clipboard.')
      } catch {
        setNotice('Clipboard was blocked. Copy the message below.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function openMail() {
    setError('')
    setNotice('')
    if (!email) {
      setError('Add the patient email on their profile first. Reminders go only to the patient.')
      return
    }
    setBusy(true)
    try {
      const data = await api('/api/reminders/whatsapp-template', {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, record_id: recordId || undefined })
      })
      setMsg91(Boolean(data.msg91))
      setMail({
        subject: `Appointment reminder — ${CLINIC.name}`,
        body: data.message
      })
      setMailOpen(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendMail(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/reminders/email', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          record_id: recordId || undefined,
          subject: mail.subject,
          body: mail.body
        })
      })
      setMailOpen(false)
      setNotice(`Email sent to ${result.to}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendSms() {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await api('/api/reminders/sms', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          record_id: recordId || undefined
        })
      })
      setNotice(`SMS sent to ${result.mobile}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={compact ? 'reminder compact' : 'reminder'}>
      <div className="row-actions">
        <button className="btn small" type="button" onClick={copyReminder} disabled={busy}>Reminder</button>
        <button className="btn small" type="button" onClick={openMail} disabled={busy}>Email</button>
        <button className="btn small" type="button" onClick={sendSms} disabled={busy}>SMS</button>
      </div>
      {notice && <p className="ok-note">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      {wa && (
        <div className="wa-box">
          <textarea readOnly value={wa.message} rows={10} />
          {wa.wa_link ? (
            <a className="btn small primary" href={wa.wa_link} target="_blank" rel="noreferrer">Open WhatsApp</a>
          ) : (
            <p className="form-error">This patient has no mobile number for WhatsApp.</p>
          )}
        </div>
      )}
      {mailOpen && (
        <form className="mail-box" onSubmit={sendMail}>
          <label>
            To (patient email only)
            <input value={email || ''} readOnly />
          </label>
          <label>
            Subject
            <input value={mail.subject} onChange={(event) => setMail({ ...mail, subject: event.target.value })} required />
          </label>
          <label>
            Message
            <textarea rows={8} value={mail.body} onChange={(event) => setMail({ ...mail, body: event.target.value })} required />
          </label>
          <p className="muted">
            Email goes to the patient only.
            {msg91 ? ' MSG91 SMS is configured for auto reminders.' : ' Add MSG91 keys in server/.env for auto SMS.'}
          </p>
          <div className="row-actions">
            <button className="btn primary small" type="submit" disabled={busy}>Send email</button>
            <button className="btn ghost small" type="button" onClick={() => setMailOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
