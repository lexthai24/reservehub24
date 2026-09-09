import "dotenv/config";
import { z } from "zod";

export const env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgres://reservehub:reservehub@localhost:5432/reservehub"),
  JWT_SECRET: z.string().min(32).default("local-development-secret-change-me-please"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  API_PORT: z.coerce.number().int().positive().default(4000),
}).parse(process.env);
