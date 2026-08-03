import { serve } from "@hono/node-server";
import { createDbClient, type DbClient } from "@techdex/db";
import { Hono } from "hono";

import { parseServerConfig } from "./config";

export const createServerApp = (database: Pick<DbClient, "$queryRaw">) => {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));
  app.get("/ready", async (context) => {
    try {
      await database.$queryRaw`SELECT 1`;
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "unavailable" }, 503);
    }
  });

  app.notFound((context) => context.json({ error: "not_found" }, 404));
  app.onError((_error, context) =>
    context.json({ error: "internal_error" }, 500),
  );

  return app;
};

const main = () => {
  const config = parseServerConfig();
  const database = createDbClient(config.DATABASE_URL);
  const app = createServerApp(database);
  const server = serve({
    fetch: app.fetch,
    hostname: config.HOST,
    port: config.PORT,
  });

  const shutdown = () => {
    server.close(async (error) => {
      await database.$disconnect();
      process.exit(error ? 1 : 0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
