# SpotCheck — Offline-First Facility Inspection & Maintenance Platform

SpotCheck is a production-minded full-stack web application built for facility management teams to conduct structured inspections, record defects, coordinate maintenance work, and verify repairs under unreliable network conditions.

The system features offline data storage, idempotent batch synchronization, concurrent-edit conflict detection, resumable photo evidence uploads, and a server-enforced work order state machine.

---

## 1. System Architecture

SpotCheck is architected as a TypeScript-first monorepo:

```
SpotCheck/
├── shared/                     # Shared TypeScript contracts & schemas
│   ├── src/
│   │   ├── types.ts            # Canonical domain models & enums
│   │   ├── validation.ts       # Zod schemas shared between client & server
│   │   └── index.ts
├── server/                     # Node.js + Express + Prisma REST API
│   ├── prisma/
│   │   ├── schema.prisma       # MongoDB database schema (Prisma ORM)
│   │   └── seed.ts             # Realistic facility, template & user seed data
│   ├── src/
│   │   ├── routes/             # Versioned REST endpoints (/api/v1/*)
│   │   ├── middleware/         # Auth, RBAC, error handling, validation
│   │   ├── services/           # State machines, idempotency, audit services
│   │   ├── db/                 # Prisma client instance
│   │   └── index.ts            # Express entrypoint with graceful shutdown
│   └── tests/
│       └── api.test.ts         # Vitest integration test suite (20 tests)
├── client/                     # React + Vite + Tailwind PWA
│   ├── src/
│   │   ├── offline/            # IndexedDB (Dexie), SyncManager, UploadQueue
│   │   ├── context/            # AuthContext, SyncContext
│   │   ├── components/         # Design system (cards, badges, modals, skeletons)
│   │   ├── pages/              # 19 role-specific production views
│   │   └── api/                # Typed API client with offline fallback
│   └── vite.config.ts          # Vite configuration with PWA service worker
└── package.json                # Root workspace configuration
```

---

## 2. Visual Design System

The interface adheres strictly to an understated industrial SaaS visual language:

- **Background:** Warm Ivory (`#F7F4EE`)
- **Surfaces:** Pure White (`#FFFFFF`) with Sand Secondary (`#DED2C0`)
- **Primary Text:** Charcoal (`#292824`)
- **Navigation:** Deep Charcoal Navigation (`#302F2A`)
- **Primary Accent:** Terracotta (`#C66B4E`), Hover (`#A9543B`)
- **Warm Borders:** Border Warm (`#E6DED2`)
- **Status Indicators:**
  - *Success:* Graphite Sage (`#687568`)
  - *Warning:* Warm Amber (`#B98535`)
  - *Error:* Accessible Crimson (`#A33F35`)
- **Typography:** Inter with tabular numerals for counts, versions, and metrics.
- **Rules:** No blue, cyan, purple, violet, or pink elements.

---

## 3. Application Roles & Seed Credentials

Authentication uses secure bcrypt password hashing and JWT/session tokens with server-enforced role authorization.

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Facility Manager** | `manager@spotcheck.io` | `Password123!` | Full control: facilities, zones, checkpoints, templates, schedules, audit log, conflict reconciliation, exports. |
| **Inspector** | `inspector@spotcheck.io` | `Password123!` | On-site inspections, QR checkpoint verification, offline draft execution, defect reporting. |
| **Maintenance Technician** | `tech@spotcheck.io` | `Password123!` | Assigned work orders, state progression (`IN_PROGRESS` → `RESOLVED`), repair evidence capture. |

---

## 4. Key Workflows & Reliability Features

### A. Offline-First Checklists & Outbox Queue
- **IndexedDB via Dexie.js:** Inspections, drafts, and work orders are persisted locally.
- **Client-Generated UUIDs:** Every record created offline has a collision-free UUID v4.
- **Persistent Outbox:** Mutations are stored in `db.offlineOutbox` with unique idempotency keys (`idemp_{entity}_{id}_{timestamp}_{rand}`).
- **Network Resilience:** The engine automatically flushes the outbox upon reconnection (`window.addEventListener('online')`) and provides manual trigger controls.

### B. Idempotency & Batch Synchronization Protocol
- Operations are sent in batches to `POST /api/v1/sync`.
- The server processes each operation inside an atomic database transaction.
- Duplicate operation replays return `ALREADY_PROCESSED` without double-mutating database state.
- Revoked users are rejected at sync time with HTTP 403, preserving the client copy for review.

### C. Optimistic Concurrency & Conflict Detection
- Records carry an integer concurrency token (`version`).
- When a client submits an update against a stale `baseVersion`, the server flags a `CONFLICT`.
- The server stores the base version, local client payload, and current server payload.
- Managers review conflicts side-by-side in `/conflicts` and choose deterministic resolution strategies (`ACCEPT_SERVER`, `FORCE_CLIENT`, or `MANUAL_MERGE`) with mandatory audit notes.

### D. Strict Work Order State Machine
Server-enforced lifecycle transitions:
```
REPORTED ──> ASSIGNED ──> IN_PROGRESS ──> RESOLVED ──> VERIFIED (Terminal)
                              ▲               │
                              └── (Rejected) ─┘
```
- Only authorized Facility Managers can transition to `VERIFIED` or reject back to `IN_PROGRESS`.
- `RESOLVED` requires technician resolution notes.
- A rejected verification requires a documented rejection reason.
- Arbitrary client status bypasses are rejected with HTTP 400.

### E. Resumable Chunked Photo Evidence Uploads
- Large evidence photos are sliced into 512 KB chunks in IndexedDB.
- `uploadQueue` initiates uploads via `POST /api/v1/uploads/initiate`.
- Interrupted uploads query `GET /api/v1/uploads/:id/status` to determine received chunks and resume only missing segments without re-uploading the entire file.

---

## 5. Quickstart & Local Setup

### Prerequisites
- Node.js (v18+)
- MongoDB (v6.0+) running with replica set enabled (Prisma requires a replica set for interactive transactions and nested mutations)

> **MongoDB Replica Set Note:**
> If running a local `mongod`, initialize a single-node replica set `rs0`:
> ```bash
> # Example: Start local mongod with replica set rs0
> mongod --port 27018 --dbpath ./mongo-data --replSet rs0 --bind_ip 127.0.0.1
>
> # In mongosh:
> rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] })
> ```

### Setup Instructions

1. **Clone and Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp server/.env.example server/.env
   ```
   Ensure `DATABASE_URL` in `server/.env` points to your MongoDB instance with replica set:
   ```env
   DATABASE_URL=mongodb://127.0.0.1:27018/spotcheck?replicaSet=rs0&directConnection=true
   ```

3. **Push Schema & Seed Database:**
   ```bash
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   ```

4. **Start Development Servers (Concurrently):**
   ```bash
   npm run dev
   ```
   - **Frontend:** `http://localhost:5173`
   - **Backend API:** `http://localhost:5000`

---

## 6. Testing & Quality Verification

### Automated Integration Tests (Vitest & Supertest)
Run the full test suite from the repository root:
```bash
npm run test
```

**Test Coverage Summary (20 passing integration tests):**
- Authentication (login, token verification, invalid credentials, sessions)
- Server-side RBAC (Manager vs Inspector vs Technician endpoint access)
- Audit trail emission on security actions and data modifications
- Checkpoint QR token lookup & validation
- Work order state machine valid transitions and illegal transition rejections
- Idempotent sync operation replays & duplicate detection
- Stale version concurrency conflict flagging
- Revoked user sync rejection
- Analytics aggregation & CSV report generation

### Production Build Verification
```bash
npm run build
```
Compiles `@spotcheck/shared`, generates the Prisma client, builds the Node server (`dist/`), and creates the optimized Vite PWA distribution with service worker precaching.

---

## 7. API Reference Overview

All API routes are versioned under `/api/v1`:

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | Public | Service health & database ping |
| `/api/v1/auth/login` | POST | Public | Authenticates user; returns JWT & session cookie |
| `/api/v1/auth/me` | GET | Authenticated | Current user profile |
| `/api/v1/facilities` | GET, POST | Manager / Inspector | Facility management |
| `/api/v1/checkpoints/by-token/:token` | GET | Inspector | Verifies QR checkpoint token on-site |
| `/api/v1/templates` | GET, POST | Manager | Versioned inspection template builder |
| `/api/v1/inspections` | GET, POST | Inspector | Submit inspection records |
| `/api/v1/work-orders` | GET, POST | All Roles | Work order list & defect inbox |
| `/api/v1/work-orders/:id/transition` | POST | Authorized | State machine transition enforcement |
| `/api/v1/sync` | POST | Authenticated | Batch idempotent outbox synchronization |
| `/api/v1/conflicts` | GET, POST | Manager | Query and reconcile concurrency conflicts |
| `/api/v1/uploads/initiate` | POST | Authenticated | Initialize chunked photo upload |
| `/api/v1/uploads/:id/chunk` | POST | Authenticated | Upload 512KB chunk with offset verification |
| `/api/v1/analytics/dashboard` | GET | Manager | Operational KPI counts & failure rates |
| `/api/v1/reports/inspections/csv` | GET | Manager | Export audit-logged inspection CSV |
| `/api/v1/audit` | GET | Manager | Immutable audit trail inquiry |
