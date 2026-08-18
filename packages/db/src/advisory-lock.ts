import { Pool, type PoolClient } from "pg";

const SYNC_LOCK_NAME = "findthatproject:telegram-analysis-sync";
const DIGEST_LOCK_NAME = "findthatproject:weekly-telegram-digest";

export interface AdvisoryLock {
  readonly acquired: boolean;
  release(): Promise<void>;
}

class PostgresAdvisoryLock implements AdvisoryLock {
  readonly acquired: boolean;
  readonly #pool: Pool;
  readonly #client: PoolClient | null;
  readonly #lockName: string;
  #released = false;

  constructor(
    pool: Pool,
    client: PoolClient | null,
    acquired: boolean,
    lockName: string,
  ) {
    this.#pool = pool;
    this.#client = client;
    this.acquired = acquired;
    this.#lockName = lockName;
  }

  async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    try {
      if (this.#client && this.acquired) {
        await this.#client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [this.#lockName],
        );
      }
    } finally {
      this.#client?.release();
      await this.#pool.end();
    }
  }
}

const acquireAdvisoryLock = async (
  databaseUrl: string,
  lockName: string,
): Promise<AdvisoryLock> => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [lockName],
    );
    const acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      client.release();
      await pool.end();
      return { acquired: false, release: async () => undefined };
    }
    return new PostgresAdvisoryLock(pool, client, true, lockName);
  } catch (error) {
    client.release();
    await pool.end();
    throw error;
  }
};

export const acquireSyncAdvisoryLock = (
  databaseUrl: string,
): Promise<AdvisoryLock> => acquireAdvisoryLock(databaseUrl, SYNC_LOCK_NAME);

export const acquireDigestAdvisoryLock = (
  databaseUrl: string,
): Promise<AdvisoryLock> => acquireAdvisoryLock(databaseUrl, DIGEST_LOCK_NAME);
