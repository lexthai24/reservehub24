import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./env.js";
import { configureAuth } from "./auth.js";
import { registerRoutes } from "./routes.js";

export function buildApp() {
  const app = Fastify({ logger: { transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined }, requestIdHeader: "x-request-id" });
  void app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  void app.register(cookie);
  void app.register(helmet);
  void app.register(jwt, { secret: env.JWT_SECRET, cookie: { cookieName: "reservehub_session", signed: false } });
  void app.register(rateLimit, { max: 120, timeWindow: "1 minute", keyGenerator: (request) => request.ip });
  void app.register(swagger, { openapi: { info: { title: "ReserveHub API", version: "1.0.0" }, servers: [{ url: `http://localhost:${env.API_PORT}` }] } });
  void app.register(swaggerUi, { routePrefix: "/docs" });
  void configureAuth(app);
  void registerRoutes(app);
  app.get("/health", async () => ({ status: "ok", service: "reservehub-api" }));
  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    const message = statusCode < 500 && error instanceof Error ? error.message : "Unexpected server error";
    request.log.error({ err: error, requestId: request.id }, "request failed");
    void reply.code(statusCode < 500 ? statusCode : 500).send({ error: "INTERNAL_ERROR", message, requestId: request.id });
  });
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildApp();
  app.listen({ port: env.API_PORT, host: "0.0.0.0" }).catch((error) => { app.log.error(error); process.exit(1); });
}
