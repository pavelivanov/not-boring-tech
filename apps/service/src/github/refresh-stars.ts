import type { DbClient } from "@findthatproject/db";
import { z } from "zod";

import { visibleCatalogWhere } from "../catalog/queries";
import {
  parseGitHubRepositoryUrl,
  type GitHubRepository,
} from "./repository-url";

export {
  canonicalGitHubRepositoryUrl,
  parseGitHubRepositoryUrl,
  type GitHubRepository,
} from "./repository-url";

const GITHUB_API_VERSION = "2026-03-10";
const githubResponseSchema = z.object({
  full_name: z.string().min(3).max(201),
  stargazers_count: z.number().int().min(0),
});

export interface GitHubRefreshResult {
  readonly discovered: number;
  readonly attempted: number;
  readonly updated: number;
  readonly notModified: number;
  readonly unavailable: number;
  readonly failed: number;
  readonly rateLimited: boolean;
  readonly authenticationFailed: boolean;
}

interface RefreshGitHubStarsOptions {
  readonly token?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  readonly maxRepositories?: number;
}

const sameRepository = (left: string | null, right: string): boolean =>
  left?.toLocaleLowerCase("en") === right.toLocaleLowerCase("en");

export const refreshGitHubStars = async (
  database: DbClient,
  options: RefreshGitHubStarsOptions = {},
): Promise<GitHubRefreshResult> => {
  const request = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const maximum = options.maxRepositories ?? (options.token ? 500 : 50);
  const rows = await database.catalogItem.findMany({
    where: visibleCatalogWhere,
    select: {
      id: true,
      canonicalUrl: true,
      githubUrl: true,
      githubRepository: true,
      githubStars: true,
      githubStarsFetchedAt: true,
      githubEtag: true,
    },
  });
  const repositories: Array<{
    readonly row: (typeof rows)[number];
    readonly repository: GitHubRepository;
  }> = [];

  for (const row of rows) {
    const repository =
      parseGitHubRepositoryUrl(row.githubUrl) ??
      parseGitHubRepositoryUrl(row.canonicalUrl);
    if (repository !== null) {
      repositories.push({ row, repository });
      continue;
    }
    if (
      row.githubRepository !== null ||
      row.githubStars !== null ||
      row.githubStarsFetchedAt !== null ||
      row.githubEtag !== null
    ) {
      await database.catalogItem.update({
        where: { id: row.id },
        data: {
          githubRepository: null,
          githubStars: null,
          githubStarsFetchedAt: null,
          githubEtag: null,
        },
      });
    }
  }

  repositories.sort(
    (left, right) =>
      (left.row.githubStarsFetchedAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
      (right.row.githubStarsFetchedAt?.getTime() ?? Number.NEGATIVE_INFINITY),
  );

  let attempted = 0;
  let updated = 0;
  let notModified = 0;
  let unavailable = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let rateLimited = false;
  let authenticationFailed = false;

  for (const { row, repository } of repositories.slice(0, maximum)) {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "findthatproject-catalog",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (
      sameRepository(row.githubRepository, repository.fullName) &&
      row.githubEtag
    ) {
      headers["If-None-Match"] = row.githubEtag;
    }

    attempted += 1;
    try {
      const response = await request(
        `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
      const checkedAt = now();

      if (response.status === 304) {
        await database.catalogItem.update({
          where: { id: row.id },
          data: {
            githubRepository: repository.fullName,
            githubStarsFetchedAt: checkedAt,
          },
        });
        notModified += 1;
        consecutiveFailures = 0;
        continue;
      }

      if (response.ok) {
        const parsed = githubResponseSchema.safeParse(await response.json());
        const responseRepository = parsed.success
          ? parseGitHubRepositoryUrl(
              `https://github.com/${parsed.data.full_name}`,
            )
          : null;
        if (!parsed.success || responseRepository === null) {
          failed += 1;
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) break;
          continue;
        }
        const etag = response.headers.get("etag");
        await database.catalogItem.update({
          where: { id: row.id },
          data: {
            githubRepository: responseRepository.fullName,
            githubStars: parsed.data.stargazers_count,
            githubStarsFetchedAt: checkedAt,
            githubEtag: etag !== null && etag.length <= 255 ? etag : null,
          },
        });
        updated += 1;
        consecutiveFailures = 0;
        continue;
      }

      if (response.status === 404 || response.status === 410) {
        await database.catalogItem.update({
          where: { id: row.id },
          data: {
            githubRepository: repository.fullName,
            githubStars: null,
            githubStarsFetchedAt: checkedAt,
            githubEtag: null,
          },
        });
        unavailable += 1;
        consecutiveFailures = 0;
        continue;
      }

      failed += 1;
      if (response.status === 401) {
        authenticationFailed = true;
        break;
      }
      if (response.status === 403 || response.status === 429) {
        rateLimited = true;
        break;
      }
      consecutiveFailures += 1;
      if (response.status >= 500 || consecutiveFailures >= 3) break;
    } catch {
      failed += 1;
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) break;
    }
  }

  return {
    discovered: repositories.length,
    attempted,
    updated,
    notModified,
    unavailable,
    failed,
    rateLimited,
    authenticationFailed,
  };
};
