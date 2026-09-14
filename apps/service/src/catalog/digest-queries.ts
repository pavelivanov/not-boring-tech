import {
  digestRunSchema,
  technologyKindSchema,
  type DigestRun,
} from "@findthatproject/contracts";
import {
  WeeklyDigestRunStatus,
  type DbClient,
  type Prisma,
} from "@findthatproject/db";

const latestRunWhere = {
  status: WeeklyDigestRunStatus.SUCCEEDED,
} satisfies Prisma.WeeklyDigestRunWhereInput;

export const getDigestRun = async (
  database: DbClient,
  runId: string | null,
): Promise<DigestRun | null> => {
  const run =
    runId === null
      ? await database.weeklyDigestRun.findFirst({
          where: latestRunWhere,
          orderBy: [{ windowEnd: "desc" }, { id: "desc" }],
        })
      : await database.weeklyDigestRun.findUnique({ where: { id: runId } });
  if (run === null) return null;

  const items = await database.weeklyDigestItem.findMany({
    where: { digestRunId: run.id },
    orderBy: [{ ordinal: "asc" }, { id: "asc" }],
  });

  return digestRunSchema.parse({
    id: run.id,
    windowStart: run.windowStart.toISOString(),
    windowEnd: run.windowEnd.toISOString(),
    itemCount: run.itemCount,
    selectedCount: run.selectedCount ?? run.itemCount,
    items: items.map((item) => ({
      ordinal: item.ordinal,
      slug: item.slug,
      name: item.name,
      nameRu: item.nameRu,
      kind: technologyKindSchema.parse(item.kind),
      canonicalUrl: item.canonicalUrl,
      githubUrl: item.githubUrl,
      githubRepository: item.githubRepository,
      githubStars: item.githubStars,
      descriptionEn: item.descriptionEn,
      descriptionRu: item.descriptionRu,
      catalogCreatedAt: item.catalogCreatedAt.toISOString(),
    })),
  });
};
