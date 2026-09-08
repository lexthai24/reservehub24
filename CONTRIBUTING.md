# Contributing

1. Copy `.env.example` to `.env` and start PostgreSQL with `docker compose up -d`.
2. Run `pnpm install`, `pnpm db:migrate`, and `pnpm db:seed`.
3. Use `pnpm dev` for the web app and API together.
4. Before opening a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Keep business rules in the API, validate every external input with Zod, and add a regression test for concurrency-sensitive behavior. Never commit `.env`, credentials, or production data.
