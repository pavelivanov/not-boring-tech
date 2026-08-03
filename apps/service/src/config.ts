import { z } from "zod";

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const TELEGRAM_HANDLE = /^@[a-z][a-z0-9_]{4,31}$/i;
const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
const LOCAL_API_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000";

const boundedInteger = (name: string, minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${name} must be an integer`)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));

const databaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);
      if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
        context.addIssue({
          code: "custom",
          message: "DATABASE_URL must use PostgreSQL",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "DATABASE_URL must be a valid PostgreSQL URL",
      });
    }
  });

const allowedOriginsSchema = z
  .string()
  .default(LOCAL_API_ORIGINS)
  .transform((value, context) => {
    const origins = value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const normalized: string[] = [];
    for (const origin of origins) {
      try {
        const url = new URL(origin);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.pathname !== "/" ||
          url.search ||
          url.hash ||
          origin === "*"
        ) {
          throw new Error("invalid origin");
        }
        normalized.push(url.origin);
      } catch {
        context.addIssue({
          code: "custom",
          message: "API_ALLOWED_ORIGINS must contain only HTTP(S) origins",
        });
        return z.NEVER;
      }
    }
    const unique = [...new Set(normalized)];
    if (unique.length < 1 || unique.length > 10) {
      context.addIssue({
        code: "custom",
        message: "API_ALLOWED_ORIGINS must contain 1-10 unique origins",
      });
      return z.NEVER;
    }
    return unique;
  });

const commonSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: boundedInteger("PORT", 1, 65_535).default(3001),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

const serverSchema = commonSchema.extend({
  API_ALLOWED_ORIGINS: allowedOriginsSchema,
});

const syncSchema = commonSchema.extend({
  TELEGRAM_API_ID: boundedInteger("TELEGRAM_API_ID", 1, 2_147_483_647),
  TELEGRAM_API_HASH: z.string().trim().min(1),
  TELEGRAM_SESSION: z.string().trim().min(1),
  TELEGRAM_CHANNELS: z.string().transform((value, context) => {
    const channels = value
      .split(",")
      .map((channel) => channel.trim().toLowerCase())
      .filter(Boolean);
    const uniqueChannels = [...new Set(channels)];

    if (channels.length !== uniqueChannels.length) {
      context.addIssue({
        code: "custom",
        message: "TELEGRAM_CHANNELS must be unique",
      });
      return z.NEVER;
    }
    if (uniqueChannels.length < 1 || uniqueChannels.length > 10) {
      context.addIssue({
        code: "custom",
        message: "TELEGRAM_CHANNELS must contain 1-10 handles",
      });
      return z.NEVER;
    }
    if (uniqueChannels.some((channel) => !TELEGRAM_HANDLE.test(channel))) {
      context.addIssue({
        code: "custom",
        message: "TELEGRAM_CHANNELS contains an invalid public handle",
      });
      return z.NEVER;
    }

    return uniqueChannels;
  }),
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1),
  TELEGRAM_BACKFILL_DAYS: boundedInteger(
    "TELEGRAM_BACKFILL_DAYS",
    1,
    90,
  ).default(90),
  TELEGRAM_PAGE_SIZE: boundedInteger("TELEGRAM_PAGE_SIZE", 1, 100).default(50),
  OPENAI_REQUEST_TIMEOUT_MS: boundedInteger(
    "OPENAI_REQUEST_TIMEOUT_MS",
    1_000,
    120_000,
  ).default(30_000),
  OPENAI_MAX_ATTEMPTS: boundedInteger("OPENAI_MAX_ATTEMPTS", 1, 3).default(3),
});

const extractionEvalSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_MODEL: z.string().trim().min(1),
  OPENAI_REQUEST_TIMEOUT_MS: boundedInteger(
    "OPENAI_REQUEST_TIMEOUT_MS",
    1_000,
    120_000,
  ).default(30_000),
  OPENAI_MAX_ATTEMPTS: boundedInteger("OPENAI_MAX_ATTEMPTS", 1, 3).default(3),
});

export type ServerConfig = z.infer<typeof serverSchema>;
export type SyncConfig = z.infer<typeof syncSchema>;
export type ExtractionEvalConfig = z.infer<typeof extractionEvalSchema>;

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly z.core.$ZodIssue[]) {
    const messages = issues.map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    );
    super(`Invalid configuration: ${messages.join("; ")}`);
    this.name = "ConfigError";
    this.issues = messages;
  }
}

const parseWith = <Output>(
  schema: z.ZodType<Output>,
  environment: NodeJS.ProcessEnv,
): Output => {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }
  return result.data;
};

export const parseServerConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig => parseWith(serverSchema, environment);

export const parseSyncConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): SyncConfig => parseWith(syncSchema, environment);

export const parseExtractionEvalConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): ExtractionEvalConfig => parseWith(extractionEvalSchema, environment);
