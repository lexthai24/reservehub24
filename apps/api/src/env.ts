import "dotenv/config";
import { z } from "zod";

const defaultDatabaseUrl = "postgres://reservehub:reservehub@localhost:5432/reservehub";
const defaultJwtSecret = "local-development-secret-change-me-please";
const defaultWebOrigin = "http://localhost:5173";

export const env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default(defaultDatabaseUrl),
  JWT_SECRET: z.string().min(32).default(defaultJwtSecret),
  WEB_ORIGIN: z.string().url().default(defaultWebOrigin),
  API_PORT: z.coerce.number().int().positive().default(4000),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  if (value.DATABASE_URL === defaultDatabaseUrl) context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "DATABASE_URL must be configured in production" });
  if (value.JWT_SECRET === defaultJwtSecret) context.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_SECRET"], message: "JWT_SECRET must be configured in production" });
  if (value.WEB_ORIGIN === defaultWebOrigin) context.addIssue({ code: z.ZodIssueCode.custom, path: ["WEB_ORIGIN"], message: "WEB_ORIGIN must be configured in production" });
}).parse(process.env);
