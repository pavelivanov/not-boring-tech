import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "./generated/prisma/client";

export const createDbClient = (databaseUrl: string): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
};

export type DbClient = PrismaClient;
export type DbTransaction = Prisma.TransactionClient;
