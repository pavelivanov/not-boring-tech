import type { DbClient } from "@techdex/db";

export const reconcileChannels = async (
  database: DbClient,
  configuredHandles: readonly string[],
) =>
  database.$transaction(async (transaction) => {
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
    return channels;
  });
