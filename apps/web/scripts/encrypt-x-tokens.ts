/**
 * One-time migration: encrypt existing plaintext X OAuth tokens in the database.
 *
 * Run with:
 *   cd apps/web && npx tsx scripts/encrypt-x-tokens.ts
 *
 * The script is idempotent — already-encrypted tokens (starting with "v1:") are
 * skipped automatically, so it is safe to run multiple times or after a partial run.
 *
 * Prerequisites:
 *   - .env.local must exist in apps/web/ (loaded automatically below).
 */

import fs from "fs";
import path from "path";

// Load .env.local before importing anything that reads env vars.
// Uses Node's built-in fs — no dotenv dependency required.
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

import { PrismaClient } from "@prisma/client";
import { encryptSnipRadarSecret } from "../lib/snipradar/public-api";

const prisma = new PrismaClient();

const ENCRYPTED_PREFIX = "v1:";
const BEARER_ONLY = "bearer-only";

function needsEncryption(value: string | null): value is string {
  if (!value) return false;
  if (value === BEARER_ONLY) return false;          // sentinel — never encrypt
  if (value.startsWith(ENCRYPTED_PREFIX)) return false; // already encrypted
  return true;
}

async function main() {
  console.log("🔐 Starting X OAuth token encryption migration...\n");

  const accounts = await prisma.xAccount.findMany({
    select: { id: true, xUsername: true, accessToken: true, refreshToken: true },
  });

  console.log(`Found ${accounts.length} X account(s) to check.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const account of accounts) {
    const encryptAccess = needsEncryption(account.accessToken);
    const encryptRefresh = needsEncryption(account.refreshToken);

    if (!encryptAccess && !encryptRefresh) {
      skipped++;
      continue;
    }

    try {
      await prisma.xAccount.update({
        where: { id: account.id },
        data: {
          ...(encryptAccess && {
            accessToken: encryptSnipRadarSecret(account.accessToken),
          }),
          ...(encryptRefresh && {
            refreshToken: encryptSnipRadarSecret(account.refreshToken!),
          }),
        },
      });

      console.log(
        `  ✅ @${account.xUsername} — encrypted ${[
          encryptAccess && "accessToken",
          encryptRefresh && "refreshToken",
        ]
          .filter(Boolean)
          .join(", ")}`
      );
      updated++;
    } catch (err) {
      console.error(`  ❌ @${account.xUsername} (${account.id}): ${err}`);
      errors++;
    }
  }

  console.log(`
Migration complete:
  ✅ Updated : ${updated}
  ⏭️  Skipped : ${skipped} (already encrypted or bearer-only)
  ❌ Errors  : ${errors}
`);

  if (errors > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
