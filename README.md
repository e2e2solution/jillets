# Jillet Dental Care

Admin system for **Jillet Dental Care**, Premium Dental Clinic, Pallikkara.

Patients, daily visits across seven departments, assisting doctors, upcoming appointments, WhatsApp reminder text, email reminders, and patient report downloads (PDF and image).

## Stack

- Admin web: React 18, Vite 5, React Router 6
- API: Node.js (ESM), Express 4
- Database: MongoDB Atlas only (`jillet_dental`)
- Auth: JWT staff login

## Ports

| App | URL |
|-----|-----|
| API | http://localhost:3002 |
| Admin | http://localhost:5174 |

On the same Wi-Fi, open `http://<this-PC-LAN-IP>:5174/` from a phone.

## Setup

```bash
cd jillet-dental
npm run install:all
```

Copy `server/.env.example` to `server/.env` if it is missing, then fill in Atlas and auth values. `server/.env` is gitignored. Do not commit it or push it to a public repo.

```bash
npm run dev:server
npm run dev:client
```

Health check: http://localhost:3002/api/health — `mongo` should be `true`.

Dev login is whatever you set as `AUTH_USERNAME` / `AUTH_PASSWORD` in `server/.env`. The sample file uses `admin` / `jillet123`. Change both, and `JWT_SECRET`, before handing the system to the clinic.

## Atlas

- Database name must stay **jillet_dental** so clinic data stays separate from other apps on the same cluster.
- Network Access must allow this PC (and later Render). `0.0.0.0/0` is the setting that lets both connect.

## Email

Set SMTP in `server/.env`. The clinic Gmail sends reminders **to the patient email only**.

Automatic job (while the API is running):

- every 24 hours
- emails patients with an appointment in **5 days**
- emails patients with an appointment **tomorrow**
- skips patients with no email, and does not send the same reminder twice

Add each patient's email on **Add / Edit patient**. Manual Email on the patient page also goes only to that patient address.

## MSG91 SMS (India)

Automatic SMS uses the same 24-hour job (5 days before + 1 day before) and the patient's **mobile** number.

1. Create an MSG91 account and complete **DLT** registration for India.
2. Approve a transactional template, for example:

```text
Hello ##name##, reminder from ##clinic##. Your dental appointment is on ##date##. Call ##phone##. - Jillet Dental Care
```

3. Create the matching **Flow / Template** in MSG91 and note:
   - Auth key
   - Flow / Template ID
   - Sender ID (6 characters, approved on DLT)
4. Put them in `server/.env`:

```env
MSG91_AUTH_KEY=your_auth_key
MSG91_FLOW_ID=your_flow_or_template_id
MSG91_SENDER_ID=JILLET
MSG91_VAR_NAME=name
MSG91_VAR_DATE=date
MSG91_VAR_CLINIC=clinic
MSG91_VAR_PHONE=phone
```

Variable names must match the flow exactly (case-sensitive). Until these are filled, `msg91` stays `false` on `/api/health` and SMS is skipped. Email reminders still work.

## Deploy (Render)

1. Push this repo to GitHub (private recommended).
2. In [Render](https://dashboard.render.com): **New → Blueprint** → connect the repo (uses `render.yaml`), or **New → Web Service** with:
   - Build: `npm install --prefix server && npm install --prefix client --include=dev && npm run build --prefix client`
   - Start: `NODE_ENV=production npm start --prefix server`
   - Health check: `/api/health`
3. Set environment variables on the service (do **not** upload `server/.env`):

| Required | Optional |
|----------|----------|
| `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD` | `SMTP_*`, `MAIL_FROM` |
| `MONGODB_URI`, `MONGODB_DB=jillet_dental` | `MSG91_*` |
| `CLINIC_NAME`, `CLINIC_PHONE`, `CLINIC_LOCATION` | |

4. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (or Render’s IPs) so the free web service can reach the cluster.

Production serves `/api/*` and the built admin UI from `client/dist` on one URL.
