# ReserveHub24

ReserveHub is a SaaS resource booking platform for meeting rooms, desks, equipment, and shared spaces. This repository follows the requested pnpm monorepo shape and uses Vite/React for the web client, Fastify for the API, Drizzle ORM, and PostgreSQL.

## Included

- Cookie-based JWT authentication with Argon2 password hashing and role-aware API authorization.
- Resource search/filtering, booking creation, idempotency keys, cancellation, waiting lists, notifications, analytics, and admin/audit endpoints.
- PostgreSQL `tstzrange` exclusion constraint backed by `btree_gist` to prevent overlapping confirmed bookings under concurrent writes.
- React dashboard with responsive navigation, resource explorer, calendar, booking modal, analytics charts, admin console, empty states, and accessible feedback.
- Shared Zod schemas and tested availability, waiting-list, and top-K utilities.

## Local setup

```bash
corepack enable
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:4000](http://localhost:4000), with OpenAPI UI at [http://localhost:4000/docs](http://localhost:4000/docs).

Seed credentials are for local development only:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@reservehub.local` | `Admin123!` |
| Member | `narin@reservehub.local` | `Member123!` |
| Member | `mali@reservehub.local` | `Member123!` |

## Commands

```bash
pnpm dev          # Vite + Fastify in parallel
pnpm build        # build every workspace
pnpm lint         # lint every workspace
pnpm typecheck    # strict TypeScript checks
pnpm test         # unit and API business-rule tests
pnpm test:e2e     # Playwright browser flow
pnpm db:migrate   # apply Drizzle SQL migrations
pnpm db:seed      # insert local demo data
```

## Environment

See `.env.example`. Production deployments must use a long random `JWT_SECRET`, a managed PostgreSQL URL, HTTPS, a restricted `WEB_ORIGIN`, and a secret manager rather than committed environment files.

## Design decisions

- PostgreSQL owns conflict truth. Application-level preflight checks improve error messages but cannot replace the exclusion constraint.
- JWT sessions are stored in HTTP-only cookies; passwords and tokens are never stored in localStorage.
- Role checks happen in Fastify pre-handlers, not only in the client navigation.
- Admin mutations create audit records.
- See [docs/architecture.md](docs/architecture.md) and [docs/complexity.md](docs/complexity.md) for boundaries and complexity trade-offs.

## Future improvements

Add refresh-token rotation, CSRF tokens for cross-site deployments, Redis-backed rate-limit storage, cursor pagination for very large histories, background wait-list fulfillment, email notifications, and full database-backed React Query hooks in the web client. The current frontend is intentionally self-contained for a reliable portfolio demo while the API is ready for integration.
