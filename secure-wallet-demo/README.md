# Northstar Wallet — Secure Demo Wallet

A local-first demonstration wallet with internal transfers only. **No real money, banks, or payment rails are connected.** Do not use with real customer funds or deploy publicly without a security review.

## Stack
- React + Vite + Tailwind CSS
- Node.js + Express (CommonJS)
- PostgreSQL + Sequelize
- HttpOnly cookie authentication, Argon2id password hashing, origin checks, Helmet, rate limits, Zod validation
- Double-entry ledger and transactional balance updates
- Docker Compose, migrations, seed data, Jest/Supertest tests

## Quick start (Docker)
1. Install Docker Desktop / Docker Engine + Compose.
2. Copy `.env.example` to `.env`.
3. Change `JWT_SECRET` to a random secret of at least 32 characters and change the demo credentials before sharing anything.
4. Run:
   ```bash
   docker compose up --build
   ```
5. Open http://localhost:5173 and sign in using the demo account printed below, or register a new account:
   - Email: `demo@example.com`
   - Password: `DemoWallet!2026`
   - Demo starting balance: 100,000.00 NGN

The API runs at http://localhost:4000. The frontend proxy forwards `/api` requests to it.

## Local development without Docker
Requirements: Node.js 20+, PostgreSQL 15+.
1. Create a PostgreSQL database and user.
2. In `backend/`, copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Install and migrate:
   ```bash
   cd backend
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```
4. In another terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment
See `backend/.env.example`. Never commit `.env`. `JWT_SECRET` must be a strong random value. Set `FRONTEND_ORIGIN` to your exact frontend origin in production. Use HTTPS in production. Keep `COOKIE_SECURE=true` behind HTTPS.

## API overview
- `POST /api/auth/register` — create user and demo wallet
- `POST /api/auth/login` — sign in
- `POST /api/auth/logout` — clear session cookie
- `GET /api/auth/me` — current user and balance
- `GET /api/wallet` — wallet and balance
- `GET /api/transfers` — current user's transfer history
- `POST /api/transfers` — internal transfer (requires `Idempotency-Key` header)
- `GET /api/health` — health check

Transfer body:
```json
{ "recipientEmail": "other@example.com", "amount": "1250.00", "note": "Lunch" }
```
Amounts are decimal strings with at most 2 decimal places. Currency is fixed to NGN for this demo. Each transfer writes two ledger entries inside one database transaction.

## Important design notes
- The frontend never submits or controls balances.
- All money amounts are represented as integer minor units (kobo) in the ledger and wallet.
- Transfers lock both wallets in stable ID order, check available funds, and update balances within one SQL transaction.
- Idempotency keys prevent duplicate processing on retried transfer requests.
- Ledger rows are append-only at the application layer. A production system should enforce immutability with database permissions/triggers and add reconciliation.
- Cookies are HttpOnly, SameSite=Lax, and mutations check the request Origin. HTTPS is required for production.
- This is a learning/demo project, not a certified financial product. Before real-money use, obtain a professional security review, provider integration, fraud controls, KYC/AML assessment, monitoring, backup/recovery plans, and applicable legal/regulatory approvals.

## Tests
```bash
cd backend
npm test
```
Tests use the configured database. Use a dedicated test database, never a production database.
