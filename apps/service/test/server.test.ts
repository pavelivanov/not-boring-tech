import { describe, expect, it, vi } from "vitest";

import { createServerApp } from "../src/server";

describe("service probes", () => {
  it("serves liveness without touching the database", async () => {
    const query = vi.fn();
    const response = await createServerApp({
      $queryRaw: query,
    } as never).request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports database readiness generically", async () => {
    const readyResponse = await createServerApp({
      $queryRaw: vi.fn().mockResolvedValue([{ catalogTable: "CatalogItem" }]),
    } as never).request("/ready");
    expect(readyResponse.status).toBe(200);

    const missingSchemaResponse = await createServerApp({
      $queryRaw: vi.fn().mockResolvedValue([{ catalogTable: null }]),
    } as never).request("/ready");
    expect(missingSchemaResponse.status).toBe(503);

    const unavailableResponse = await createServerApp({
      $queryRaw: vi
        .fn()
        .mockRejectedValue(new Error("private connection details")),
    } as never).request("/ready");
    expect(unavailableResponse.status).toBe(503);
    expect(await unavailableResponse.text()).not.toContain(
      "private connection details",
    );
  });

  it("returns safe request-identified errors for unknown routes", async () => {
    const response = await createServerApp({
      $queryRaw: vi.fn(),
    } as never).request("/admin");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "NOT_FOUND", requestId: expect.any(String) },
    });
  });

  it("allows CORS only for explicit origins", async () => {
    const app = createServerApp({ $queryRaw: vi.fn() } as never, {
      allowedOrigins: ["https://findthatproject.example"],
    });
    const allowed = await app.request("/v1/unknown", {
      headers: { Origin: "https://findthatproject.example" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://findthatproject.example",
    );
    expect(allowed.headers.get("access-control-allow-credentials")).toBeNull();

    const denied = await app.request("/v1/unknown", {
      headers: { Origin: "https://attacker.example" },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("serves stable catalog metadata with a bounded browser cache", async () => {
    const app = createServerApp({
      catalogItem: { findMany: vi.fn().mockResolvedValue([]) },
      channel: { findMany: vi.fn().mockResolvedValue([]) },
    } as never);

    const facets = await app.request("/v1/facets");
    const channels = await app.request("/v1/channels");

    expect(facets.status).toBe(200);
    expect(channels.status).toBe(200);
    expect(await facets.json()).toEqual({
      categories: [],
      kinds: [],
      channels: [],
    });
    expect(facets.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=300",
    );
    expect(channels.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=300",
    );
  });

  it("sanitizes unexpected database failures", async () => {
    const app = createServerApp({
      catalogItem: {
        findMany: vi
          .fn()
          .mockRejectedValue(new Error("postgresql://private:secret@db")),
      },
    } as never);
    const response = await app.request("/v1/catalog");
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("INTERNAL_ERROR");
    expect(body).not.toContain("postgresql://private:secret@db");
  });
});
