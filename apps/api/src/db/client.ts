import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL ?? "postgres://reservehub:reservehub@localhost:5432/reservehub";
export const pool = new Pool({ connectionString, max: 10 });
export const db = drizzle(pool, { schema });
