import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";
import { UserRole, type UserRole as UserRoleType } from "@reservehub/shared";
import { env } from "./env.js";

export interface AuthUser { id: string; email: string; fullName: string; role: UserRoleType; sessionVersion: number; }

declare module "fastify" {
  interface FastifyRequest { authUser: AuthUser | null; }
  interface FastifyInstance { authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>; requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>; }
}

export async function configureAuth(app: FastifyInstance): Promise<void> {
  app.decorateRequest("authUser", null);
  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
      const payload = request.user as { id: string; sessionVersion?: number };
      const [user] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, payload.id)).limit(1);
      if (!user) { await reply.code(401).send({ error: "UNAUTHORIZED", message: "Session is no longer valid" }); return; }
      if (payload.sessionVersion !== user.sessionVersion) { await reply.code(401).send({ error: "UNAUTHORIZED", message: "Session is no longer valid" }); return; }
      request.authUser = { ...user, role: user.role as UserRoleType };
    } catch { await reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required" }); }
  });
  app.decorate("requireAdmin", async (request, reply) => {
    if (!request.authUser) { await reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required" }); return; }
    if (request.authUser.role !== UserRole.ADMIN) { await reply.code(403).send({ error: "FORBIDDEN", message: "Administrator access required" }); }
  });
}

export async function setSession(reply: FastifyReply, user: Pick<AuthUser, "id" | "role" | "sessionVersion">, rememberMe = true): Promise<void> {
  const token = await reply.jwtSign({ id: user.id, role: user.role, sessionVersion: user.sessionVersion }, { expiresIn: "8h" });
  reply.setCookie("reservehub_session", token, { httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production", path: "/", ...(rememberMe ? { maxAge: 60 * 60 * 8 } : {}) });
}

export async function hashPassword(password: string): Promise<string> { return argon2.hash(password); }
export async function verifyPassword(hash: string, password: string): Promise<boolean> { return argon2.verify(hash, password); }
