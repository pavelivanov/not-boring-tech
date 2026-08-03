import type { DbClient } from "@findthatproject/db";

import { refreshCatalogItems } from "../catalog/projector";

export const reconcileChannels = async (
  database: DbClient,
  configuredHandles: readonly string[],
) =>
  database.$transaction(async (transaction) => {
    const visibilityChanges = await transaction.presentationCandidate.findMany({
      where: {
        catalogItemId: { not: null },
        analyzedPost: {
          channel: {
            OR: [
              { enabled: true, handle: { notIn: [...configuredHandles] } },
              { enabled: false, handle: { in: [...configuredHandles] } },
            ],
          },
        },
      },
      select: { catalogItemId: true },
    });

    await transaction.channel.updateMany({
      where: { enabled: true, handle: { notIn: [...configuredHandles] } },
      data: { enabled: false },
    });

    const channels = [];
    for (const handle of configuredHandles) {
      const username = handle.slice(1);
      channels.push(
        await transaction.channel.upsert({
          where: { handle },
          create: {
            handle,
            publicUrl: `https://t.me/${username}`,
            enabled: true,
          },
          update: { enabled: true },
        }),
      );
    }
    await refreshCatalogItems(
      transaction,
      visibilityChanges.flatMap((candidate) =>
        candidate.catalogItemId === null ? [] : [candidate.catalogItemId],
      ),
    );
    return channels;
  });
