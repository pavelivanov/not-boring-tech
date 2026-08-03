import { describe, expect, it } from "vitest";

import {
  ConfigError,
  parseExtractionEvalConfig,
  parseServerConfig,
  parseSyncConfig,
} from "../src/config";

const SECRET_SENTINELS = {
  DATABASE_URL:
    "postgresql://secret-user:secret-password@localhost:5432/techdex",
  TELEGRAM_API_HASH: "telegram-hash-sentinel",
  TELEGRAM_SESSION: "telegram-session-sentinel",
  OPENAI_API_KEY: "openai-key-sentinel",
};

const validSyncEnvironment = (): NodeJS.ProcessEnv => ({
  ...SECRET_SENTINELS,
  TELEGRAM_API_ID: "123456",
  TELEGRAM_CHANNELS: "@NotBoring_Tech, @CTODaily",
  OPENAI_MODEL: "structured-output-model",
});

describe("parseServerConfig", () => {
  it("requires only database and server values", () => {
    expect(
      parseServerConfig({ DATABASE_URL: SECRET_SENTINELS.DATABASE_URL }),
    ).toMatchObject({ HOST: "0.0.0.0", PORT: 3001, LOG_LEVEL: "info" });
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
    });
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
