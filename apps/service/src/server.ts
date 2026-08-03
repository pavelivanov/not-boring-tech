import { serve } from "@hono/node-server";
import {
  apiErrorResponseSchema,
  type ApiErrorResponse,
} from "@findthatproject/contracts";
import { createDbClient, type DbClient } from "@findthatproject/db";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { requestId, type RequestIdVariables } from "hono/request-id";

import {
  CatalogQueryError,
  getCatalogChannels,
  getCatalogDetail,
  getCatalogFacets,
  listCatalog,
  parseCatalogQuery,
} from "./catalog/queries";
import { parseServerConfig } from "./config";

interface ServerOptions {
  readonly allowedOrigins?: readonly string[];
}

const safeError = (
  context: Context<{ Variables: RequestIdVariables }>,
  status: 400 | 404 | 500 | 503,
  code: ApiErrorResponse["error"]["code"],
  message: string,
) =>
  context.json(
    apiErrorResponseSchema.parse({
      error: { code, message, requestId: context.get("requestId") },
    }),
    status,
  );

export const createServerApp = (
  database: DbClient,
  options: ServerOptions = {},
) => {
  const allowedOrigins = new Set(options.allowedOrigins ?? []);
  const app = new Hono<{ Variables: RequestIdVariables }>();

  app.use("*", requestId());
  app.use(
    "/v1/*",
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : undefined),
      allowMethods: ["GET", "OPTIONS"],
      allowHeaders: ["Accept", "Content-Type"],
      exposeHeaders: ["X-Request-Id"],
      maxAge: 600,
      credentials: false,
    }),
  );

  app.get("/health", (context) => context.json({ status: "ok" }));
  app.get("/ready", async (context) => {
    try {
      const result = await database.$queryRaw<
        Array<{ readonly catalogTable: string | null }>
      >`SELECT to_regclass('"CatalogItem"')::text AS "catalogTable"`;
      if (result[0]?.catalogTable === null || result.length === 0) {
        throw new Error("CATALOG_SCHEMA_MISSING");
      }
      return context.json({ status: "ready" });
    } catch {
      return context.json({ status: "unavailable" }, 503);
    }
  });

  app.get("/v1/catalog", async (context) => {
    const query = parseCatalogQuery(context.req.queries());
    return context.json(await listCatalog(database, query));
  });
  app.get("/v1/catalog/:slug", async (context) => {
    const item = await getCatalogDetail(database, context.req.param("slug"));
    return item === null
      ? safeError(
          context,
          404,
          "NOT_FOUND",
          "The requested catalog item was not found.",
        )
      : context.json(item);
  });
  app.get("/v1/facets", async (context) =>
    context.json(await getCatalogFacets(database)),
  );
  app.get("/v1/channels", async (context) =>
    context.json(await getCatalogChannels(database)),
  );

  app.notFound((context) =>
    safeError(context, 404, "NOT_FOUND", "The requested route was not found."),
  );
  app.onError((error, context) =>
    error instanceof CatalogQueryError
      ? safeError(context, 400, "BAD_REQUEST", "The catalog query is invalid.")
      : safeError(
          context,
          500,
          "INTERNAL_ERROR",
          "The request could not be completed.",
        ),
  );

  return app;
};

const main = () => {
  const config = parseServerConfig();
  const database = createDbClient(config.DATABASE_URL);
  const app = createServerApp(database, {
    allowedOrigins: config.API_ALLOWED_ORIGINS,
  });
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
