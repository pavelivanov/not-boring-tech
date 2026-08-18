const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const RESERVED_OWNERS = new Set([
  "apps",
  "collections",
  "enterprise",
  "events",
  "features",
  "issues",
  "join",
  "login",
  "logout",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "search",
  "settings",
  "sponsors",
  "topics",
  "trending",
  "users",
]);
const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38})$/i;
const REPOSITORY_PATTERN = /^[a-z0-9._-]{1,100}$/i;

export interface GitHubRepository {
  readonly owner: string;
  readonly repository: string;
  readonly fullName: string;
}

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const parseGitHubRepositoryUrl = (
  value: string | null,
): GitHubRepository | null => {
  if (value === null) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      !GITHUB_HOSTS.has(url.hostname.toLocaleLowerCase("en"))
    ) {
      return null;
    }

    const path = url.pathname.split("/").filter(Boolean);
    if (path.length < 2) return null;
    const owner = decodePathSegment(path[0]!);
    const decodedRepository = decodePathSegment(path[1]!);
    const repository = decodedRepository?.replace(/\.git$/iu, "") ?? null;
    if (
      owner === null ||
      repository === null ||
      RESERVED_OWNERS.has(owner.toLocaleLowerCase("en")) ||
      !OWNER_PATTERN.test(owner) ||
      !REPOSITORY_PATTERN.test(repository) ||
      repository === "." ||
      repository === ".."
    ) {
      return null;
    }

    return { owner, repository, fullName: `${owner}/${repository}` };
  } catch {
    return null;
  }
};

export const canonicalGitHubRepositoryUrl = (
  value: string | null,
): string | null => {
  const repository = parseGitHubRepositoryUrl(value);
  return repository === null
    ? null
    : `https://github.com/${repository.owner}/${repository.repository}`;
};
