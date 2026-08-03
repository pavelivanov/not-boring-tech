import { Pool, type PoolClient } from "pg";

const LOCK_NAME = "techdex:telegram-analysis-sync";

export interface AdvisoryLock {
  readonly acquired: boolean;
  release(): Promise<void>;
}

class PostgresAdvisoryLock implements AdvisoryLock {
  readonly acquired: boolean;
  readonly #pool: Pool;
  readonly #client: PoolClient | null;
  #released = false;

  constructor(pool: Pool, client: PoolClient | null, acquired: boolean) {
    this.#pool = pool;
    this.#client = client;
    this.acquired = acquired;
  }

  async release(): Promise<void> {
    if (this.#released) return;
    this.#released = true;
    try {
      if (this.#client && this.acquired) {
        await this.#client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [LOCK_NAME],
        );
      }
    } finally {
      this.#client?.release();
      await this.#pool.end();
    }
  }
}

export const acquireSyncAdvisoryLock = async (
  databaseUrl: string,
): Promise<AdvisoryLock> => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [LOCK_NAME],
    );
    const acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      client.release();
      await pool.end();
      return { acquired: false, release: async () => undefined };
    }
    return new PostgresAdvisoryLock(pool, client, true);
  } catch (error) {
    client.release();
    await pool.end();
    throw error;
  }
};
