# HSO PHEx & Drug Test App

Full-stack web app for DLSU Manila undergraduate students to manage their Periodic Health Examination (PHEx) and Drug Test requirements.

---

## Project Structure

```
hso-phex/
├── frontend/    React app
├── backend/     Node.js + Express API
├── database/    PostgreSQL schema
└── README.md
```

---

## Quick Start

### 1. Database
Install PostgreSQL, create a database, and run the schema:
```bash
psql -U postgres -c "CREATE DATABASE hso_phex"
psql -U postgres -d hso_phex -f database/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env        # Fill in your values
npm run dev                 # Starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm start                   # Starts on http://localhost:3000
```

---

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `RESEND_API_KEY` | Get from https://resend.com (free tier) |
| `EMAIL_FROM` | Sender email address |
| `FRONTEND_URL` | React app URL (for CORS) |

---

## API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |

### Students
| Method | Route | Description |
|---|---|---|
| GET | `/api/students/me` | Get own profile |
| PUT | `/api/students/me` | Update profile |

### Appointments
| Method | Route | Description |
|---|---|---|
| GET | `/api/appointments/slots` | Available slots for a date |
| POST | `/api/appointments` | Book an appointment |
| GET | `/api/appointments/mine` | My bookings |
| DELETE | `/api/appointments/:id` | Cancel booking |

### Forms
| Method | Route | Description |
|---|---|---|
| POST | `/api/forms/mef` | Save MEF + download filled PDF |
| POST | `/api/forms/def` | Save DEF + download filled PDF |
| GET | `/api/forms/mine` | My submitted forms |

### HSO Staff (requires HSO role)
| Method | Route | Description |
|---|---|---|
| GET | `/api/hso/appointments` | All bookings (filter by date/type) |
| PATCH | `/api/hso/appointments/:id/attend` | Mark as attended |
| PATCH | `/api/hso/appointments/:id/clear` | Mark as cleared |
| GET | `/api/hso/compliance` | Full student compliance report |
| GET | `/api/hso/stats` | Dashboard summary numbers |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, pdf-lib, pdf.js |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Email | Resend |
| PDF | pdf-lib (server-side) |

---

## Connecting Frontend to Backend

In `frontend/src/`, create an `api.js` file:

```js
const API = "http://localhost:5000/api";
const token = () => localStorage.getItem("token");

export const api = {
  register: (data) => fetch(`${API}/auth/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }).then(r => r.json()),
  login:    (data) => fetch(`${API}/auth/login`,    { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data) }).then(r => r.json()),
  me:       ()     => fetch(`${API}/students/me`,   { headers:{ Authorization: `Bearer ${token()}` } }).then(r => r.json()),
  bookAppointment: (data) => fetch(`${API}/appointments`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token()}`}, body: JSON.stringify(data) }).then(r => r.json()),
  myBookings: ()   => fetch(`${API}/appointments/mine`, { headers:{ Authorization: `Bearer ${token()}` } }).then(r => r.json()),
};
```

Then update `LoginPage.jsx` to call `api.login()` instead of the in-memory `USERS` object.

---

## Deployment

- **Frontend** → Vercel (`vercel deploy` from frontend/)
- **Backend** → Railway or Render (connect your PostgreSQL there too)
- **Database** → Supabase free tier (easiest option)
