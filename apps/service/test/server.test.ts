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
      $queryRaw: vi.fn().mockResolvedValue([1]),
    } as never).request("/ready");
    expect(readyResponse.status).toBe(200);

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

  it("does not expose additional routes", async () => {
    const response = await createServerApp({
      $queryRaw: vi.fn(),
    } as never).request("/channels");
    expect(response.status).toBe(404);
  });
});
