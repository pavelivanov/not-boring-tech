#!/usr/bin/env node
// Print a fresh GramJS user StringSession for TELEGRAM_SESSION.
//
// Usage:
//   TELEGRAM_API_ID=... TELEGRAM_API_HASH=... npm run telegram:session
//
// Requires interactive input: phone number, the login code Telegram sends, and
// the two-step verification password when the account has one. The printed
// value is a full account credential: copy it into an ignored local .env or
// .env.railway.parser, and never commit, log, or paste it anywhere else.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";

if (!Number.isInteger(apiId) || apiId <= 0 || apiHash.length === 0) {
  console.error(
    "Set TELEGRAM_API_ID (positive integer) and TELEGRAM_API_HASH before running.",
  );
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const ask = (label) => rl.question(label);

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

try {
  await client.start({
    phoneNumber: () => ask("Phone number (+1234567890): "),
    phoneCode: () => ask("Login code from Telegram: "),
    password: () => ask("Two-step verification password: "),
    onError: (error) => {
      console.error(error instanceof Error ? error.message : error);
    },
  });

  console.error("\nSecret follows. Store it in an ignored env file only.");
  console.log(`TELEGRAM_SESSION=${client.session.save()}`);
} finally {
  rl.close();
  await client.disconnect();
}

process.exit(0);
