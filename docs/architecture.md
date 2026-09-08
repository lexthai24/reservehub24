# ReserveHub architecture

```text
Browser (React + Vite + TanStack Query)
              │ HTTP-only session cookie
              ▼
Fastify API ── Zod validation ── Auth / authorization ── Pino request logs
              │
              ▼
Drizzle ORM ── PostgreSQL
              │
              ├─ exclusion constraint prevents confirmed overlaps
              ├─ unique user/idempotency key prevents duplicate retries
              └─ audit log records privileged changes
```

The web app owns rendering and ephemeral UI state. Business rules are repeated only for immediate feedback; the API is authoritative for authentication, authorization, booking validation, conflict detection, and audit behavior. Shared Zod schemas and algorithm utilities live in `packages/shared` so server and client can use the same contract without copying validation logic.

The booking write starts a transaction, verifies the resource, checks the idempotency key, and inserts the booking. PostgreSQL's `btree_gist` exclusion constraint is the final race-safe guard. An exclusion violation is translated to HTTP `409 Conflict` so concurrent clients receive a useful response instead of an internal error.
