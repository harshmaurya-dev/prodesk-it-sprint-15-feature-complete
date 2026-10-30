# Prodesk IT — Sprint 15: Feature Complete

Full-stack employee workspace following **Track B — Fullstack Developers**.

## Features
- Register and login with bcrypt password hashing
- JWT-protected REST API
- Employee create, read, update and delete
- User ownership checks on every employee operation
- React UI connected to the API
- Optimistic delete with rollback on API failure
- Dashboard totals and department overview
- Stripe Checkout integration (test mode)
- Responsive layout and useful API error messages

## Stack
React 19, Vite, React Router, Node.js, Express 5, MongoDB/Mongoose, JWT, bcryptjs and Stripe.

## Project structure
```text
client/                 React + Vite frontend
  src/main.jsx
  .env.example
  vercel.json
server/                 Express API
  server.js
  .env.example
package.json
README.md
```

## Run locally
Requires Node.js 20+.

1. Install: `npm run install-all`
2. Copy `server/.env.example` to `server/.env` and set MongoDB URI, a random JWT secret (32+ characters), frontend origin and Stripe test secret.
3. Copy `client/.env.example` to `client/.env`. Set `VITE_API_URL=http://localhost:5000/api`.
4. Run both apps: `npm run dev`
5. Open `http://localhost:5173`.

## Environment variables

Backend:
- `PORT`: API port (default 5000)
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: random secret, at least 32 characters
- `CLIENT_URL`: allowed frontend origin; comma-separated origins supported
- `STRIPE_SECRET_KEY`: Stripe test key (starts with `sk_test_`)

Frontend:
- `VITE_API_URL`: backend URL ending in `/api`

Never commit real .env files, database credentials, JWT secrets or Stripe secret keys.

## Deployment

### Backend — Render
- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Add `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` and `STRIPE_SECRET_KEY` in the service environment.
- Health check: `https://your-api-domain/api/health`

### Frontend — Vercel
- Root directory: `client`
- Framework: Vite; build command: `npm run build`; output: `dist`
- Set `VITE_API_URL` to the deployed backend URL plus `/api`.
- Redeploy after changing environment variables.
- `client/vercel.json` keeps routes such as /login, /dashboard and /success working after refresh.

## API
| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | Public | Health check |
| POST | /api/auth/register | Public | Create account |
| POST | /api/auth/login | Public | Sign in |
| GET | /api/employees | JWT | List own employees |
| POST | /api/employees | JWT | Create employee |
| PUT | /api/employees/:id | JWT | Update own employee |
| DELETE | /api/employees/:id | JWT | Delete own employee |
| POST | /api/checkout/create | JWT | Stripe Checkout session |

## Sprint 15 Track B checklist
- [x] POST / GET / PUT / DELETE endpoints
- [x] JWT authentication middleware
- [x] Ownership validation against authenticated user
- [x] React UI connected to REST API
- [x] Optimistic deletion with rollback
- [x] Stripe Checkout session and success/cancel routes

## Before submission
After deployment, test register/login, add an employee, refresh, edit and delete. Use a second account to confirm users cannot see each other's data. Complete a Stripe test-mode checkout. A successful frontend build alone does not prove the database, API or payment flow is configured.
