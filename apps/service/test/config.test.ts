import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseDigestConfig,
  parseExtractionEvalConfig,
  parseServerConfig,
  parseSyncConfig,
} from "../src/config";

const SECRET_SENTINELS = {
  DATABASE_URL:
    "postgresql://secret-user:secret-password@localhost:5432/findthatproject",
  TELEGRAM_API_HASH: "telegram-hash-sentinel",
  TELEGRAM_SESSION: "telegram-session-sentinel",
  OPENAI_API_KEY: "openai-key-sentinel",
  GITHUB_TOKEN: "github-token-sentinel",
  TELEGRAM_DIGEST_BOT_TOKEN: "telegram-bot-token-sentinel",
};

const validSyncEnvironment = (): NodeJS.ProcessEnv => ({
  ...SECRET_SENTINELS,
  TELEGRAM_API_ID: "123456",
  TELEGRAM_CHANNELS: "@NotBoring_Tech, @CTODaily",
  OPENAI_MODEL: "structured-output-model",
});

const validDigestEnvironment = (): NodeJS.ProcessEnv => ({
  DATABASE_URL: SECRET_SENTINELS.DATABASE_URL,
  TELEGRAM_DIGEST_BOT_TOKEN: SECRET_SENTINELS.TELEGRAM_DIGEST_BOT_TOKEN,
  TELEGRAM_DIGEST_CHANNEL_EN: "@Digest_English",
  TELEGRAM_DIGEST_CHANNEL_RU: "-1001234567890",
  DIGEST_SITE_ORIGIN: "https://findthatproject.example/",
  DIGEST_INITIAL_START_AT: "2026-08-10T09:00:00+00:00",
});

describe("parseServerConfig", () => {
  it("requires only database and server values", () => {
    expect(
      parseServerConfig({ DATABASE_URL: SECRET_SENTINELS.DATABASE_URL }),
    ).toMatchObject({
      HOST: "0.0.0.0",
      PORT: 3001,
      LOG_LEVEL: "info",
      API_ALLOWED_ORIGINS: ["http://localhost:3000", "http://127.0.0.1:3000"],
    });
  });

  it("normalizes an explicit CORS allowlist and rejects wildcards or paths", () => {
    expect(
      parseServerConfig({
        DATABASE_URL: SECRET_SENTINELS.DATABASE_URL,
        API_ALLOWED_ORIGINS:
          "https://findthatproject.example, http://localhost:5173/",
      }).API_ALLOWED_ORIGINS,
    ).toEqual(["https://findthatproject.example", "http://localhost:5173"]);
    expect(() =>
      parseServerConfig({
        DATABASE_URL: SECRET_SENTINELS.DATABASE_URL,
        API_ALLOWED_ORIGINS: "*",
      }),
    ).toThrow(ConfigError);
    expect(() =>
      parseServerConfig({
        DATABASE_URL: SECRET_SENTINELS.DATABASE_URL,
        API_ALLOWED_ORIGINS: "https://findthatproject.example/private",
      }),
    ).toThrow(ConfigError);
  });

  it("rejects non-PostgreSQL URLs without exposing the value", () => {
    const invalidUrl = "https://private.example/secret";
    expect(() => parseServerConfig({ DATABASE_URL: invalidUrl })).toThrow(
      ConfigError,
    );
    try {
      parseServerConfig({ DATABASE_URL: invalidUrl });
    } catch (error) {
      expect(String(error)).not.toContain(invalidUrl);
    }
  });
});

describe("parseSyncConfig", () => {
  it("normalizes channels and applies bounded defaults", () => {
    expect(parseSyncConfig(validSyncEnvironment())).toMatchObject({
      TELEGRAM_CHANNELS: ["@notboring_tech", "@ctodaily"],
      TELEGRAM_BACKFILL_DAYS: 90,
      TELEGRAM_PAGE_SIZE: 50,
      OPENAI_REQUEST_TIMEOUT_MS: 30_000,
      OPENAI_MAX_ATTEMPTS: 3,
      GITHUB_TOKEN: "github-token-sentinel",
    });
  });

  it("allows GitHub enrichment to run without authentication", () => {
    const environment = validSyncEnvironment();
    delete environment.GITHUB_TOKEN;

    expect(parseSyncConfig(environment).GITHUB_TOKEN).toBeUndefined();
    expect(
      parseSyncConfig({ ...environment, GITHUB_TOKEN: "" }).GITHUB_TOKEN,
    ).toBeUndefined();
  });

  it.each([
    ["empty", ""],
    ["duplicate", "@ctodaily,@CTODaily"],
    ["malformed", "ctodaily"],
    ["private link", "https://t.me/+private"],
  ])("rejects %s channel configuration", (_label, channels) => {
    expect(() =>
      parseSyncConfig({
        ...validSyncEnvironment(),
        TELEGRAM_CHANNELS: channels,
      }),
    ).toThrow(ConfigError);
  });

  it("never includes credentials in validation errors", () => {
    const environment = {
      ...validSyncEnvironment(),
      TELEGRAM_API_ID: "invalid",
    };
    let rendered = "";
    try {
      parseSyncConfig(environment);
    } catch (error) {
      rendered = String(error);
    }
    for (const sentinel of Object.values(SECRET_SENTINELS)) {
      expect(rendered).not.toContain(sentinel);
    }
  });

  it("enforces configured bounds", () => {
    expect(() =>
      parseSyncConfig({ ...validSyncEnvironment(), OPENAI_MAX_ATTEMPTS: "4" }),
    ).toThrow(ConfigError);
    expect(() =>
      parseSyncConfig({
        ...validSyncEnvironment(),
        TELEGRAM_BACKFILL_DAYS: "0",
      }),
    ).toThrow(ConfigError);
    expect(() =>
      parseSyncConfig({ ...validSyncEnvironment(), TELEGRAM_PAGE_SIZE: "101" }),
    ).toThrow(ConfigError);
  });
});

describe("parseExtractionEvalConfig", () => {
  it("requires only bounded OpenAI evaluation settings", () => {
    expect(
      parseExtractionEvalConfig({
        OPENAI_API_KEY: "eval-key",
        OPENAI_MODEL: "eval-model",
      }),
    ).toEqual({
      OPENAI_API_KEY: "eval-key",
      OPENAI_MODEL: "eval-model",
      OPENAI_REQUEST_TIMEOUT_MS: 30_000,
      OPENAI_MAX_ATTEMPTS: 3,
    });
  });
});

describe("parseDigestConfig", () => {
  it("normalizes distinct targets, origin, cutoff, and bounded defaults", () => {
    expect(parseDigestConfig(validDigestEnvironment())).toMatchObject({
      TELEGRAM_DIGEST_CHANNEL_EN: "@digest_english",
      TELEGRAM_DIGEST_CHANNEL_RU: "-1001234567890",
      DIGEST_SITE_ORIGIN: "https://findthatproject.example",
      DIGEST_INITIAL_START_AT: new Date("2026-08-10T09:00:00.000Z"),
      DIGEST_REQUEST_TIMEOUT_MS: 15_000,
      DIGEST_MAX_ATTEMPTS: 3,
      LOG_LEVEL: "info",
    });
  });

  it.each([
    ["same targets", { TELEGRAM_DIGEST_CHANNEL_RU: "@DIGEST_ENGLISH" }],
    ["invalid target", { TELEGRAM_DIGEST_CHANNEL_EN: "channel" }],
    ["origin path", { DIGEST_SITE_ORIGIN: "https://example.com/private" }],
    ["non-local HTTP", { DIGEST_SITE_ORIGIN: "http://example.com" }],
    [
      "cutoff without offset",
      { DIGEST_INITIAL_START_AT: "2026-08-10T09:00:00" },
    ],
    ["timeout too low", { DIGEST_REQUEST_TIMEOUT_MS: "999" }],
    ["too many attempts", { DIGEST_MAX_ATTEMPTS: "4" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      parseDigestConfig({ ...validDigestEnvironment(), ...overrides }),
    ).toThrow(ConfigError);
  });

  it("allows an HTTP origin only for local development", () => {
    expect(
      parseDigestConfig({
        ...validDigestEnvironment(),
        DIGEST_SITE_ORIGIN: "http://localhost:3000/",
      }).DIGEST_SITE_ORIGIN,
    ).toBe("http://localhost:3000");
  });

  it("never includes digest credentials or targets in validation errors", () => {
    const environment = {
      ...validDigestEnvironment(),
      DIGEST_MAX_ATTEMPTS: "invalid",
    };
    let rendered = "";
    try {
      parseDigestConfig(environment);
    } catch (error) {
      rendered = String(error);
    }
    for (const sentinel of Object.values(SECRET_SENTINELS)) {
      expect(rendered).not.toContain(sentinel);
    }
    expect(rendered).not.toContain("@Digest_English");
    expect(rendered).not.toContain("-1001234567890");
  });
});
