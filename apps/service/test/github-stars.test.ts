import type { DbClient } from "@findthatproject/db";
import { describe, expect, it, vi } from "vitest";

import {
  parseGitHubRepositoryUrl,
  refreshGitHubStars,
} from "../src/github/refresh-stars";

describe("parseGitHubRepositoryUrl", () => {
  it("recognizes repository and nested repository URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/codex")).toEqual(
      { owner: "openai", repository: "codex", fullName: "openai/codex" },
    );
    expect(
      parseGitHubRepositoryUrl(
        "https://www.github.com/withastro/astro/tree/main/packages",
      ),
    ).toMatchObject({ fullName: "withastro/astro" });
    expect(
      parseGitHubRepositoryUrl("https://github.com/owner/repository.git"),
    ).toMatchObject({ fullName: "owner/repository" });
  });

  it("rejects profiles, reserved routes, and non-GitHub hosts", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai")).toBeNull();
    expect(
      parseGitHubRepositoryUrl("https://github.com/topics/typescript"),
    ).toBeNull();
    expect(
      parseGitHubRepositoryUrl("https://example.com/openai/codex"),
    ).toBeNull();
  });
});

describe("refreshGitHubStars", () => {
  it("stores fresh counts and conditionally checks unchanged repositories", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const database = {
      catalogItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fresh",
            canonicalUrl: "https://github.com/openai/codex",
            githubRepository: null,
            githubStars: null,
            githubStarsFetchedAt: null,
            githubEtag: null,
          },
          {
            id: "cached",
            canonicalUrl: "https://github.com/withastro/astro",
            githubRepository: "withastro/astro",
            githubStars: 50_000,
            githubStarsFetchedAt: new Date("2026-08-01T00:00:00.000Z"),
            githubEtag: '"astro-etag"',
          },
        ]),
        update,
      },
    } as unknown as DbClient;
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            full_name: "openai/codex",
            stargazers_count: 42_123,
          }),
          { status: 200, headers: { etag: '"codex-etag"' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const checkedAt = new Date("2026-08-03T12:00:00.000Z");

    await expect(
      refreshGitHubStars(database, {
        token: "test-token",
        fetch: request,
        now: () => checkedAt,
      }),
    ).resolves.toEqual({
      discovered: 2,
      attempted: 2,
      updated: 1,
      notModified: 1,
      unavailable: 0,
      failed: 0,
      rateLimited: false,
      authenticationFailed: false,
    });
    expect(request).toHaveBeenNthCalledWith(
      1,
      "https://api.github.com/repos/openai/codex",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "X-GitHub-Api-Version": "2026-03-10",
        }),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/withastro/astro",
      expect.objectContaining({
        headers: expect.objectContaining({ "If-None-Match": '"astro-etag"' }),
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "fresh" },
      data: {
        githubRepository: "openai/codex",
        githubStars: 42_123,
        githubStarsFetchedAt: checkedAt,
        githubEtag: '"codex-etag"',
      },
    });
  });

  it("clears stale metadata when a catalog URL is no longer GitHub-backed", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const database = {
      catalogItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "changed",
            canonicalUrl: "https://example.com/project",
            githubRepository: "owner/old-repository",
            githubStars: 120,
            githubStarsFetchedAt: new Date("2026-08-01T00:00:00.000Z"),
            githubEtag: '"old"',
          },
        ]),
        update,
      },
    } as unknown as DbClient;

    const result = await refreshGitHubStars(database, {
      fetch: vi.fn<typeof fetch>(),
    });

    expect(result.discovered).toBe(0);
    expect(update).toHaveBeenCalledWith({
      where: { id: "changed" },
      data: {
        githubRepository: null,
        githubStars: null,
        githubStarsFetchedAt: null,
        githubEtag: null,
      },
    });
  });
});
