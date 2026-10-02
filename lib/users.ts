import { scryptSync, timingSafeEqual } from "crypto";
import type { RowDataPacket } from "mysql2";
import { query } from "./db";

const DEFAULT_ADMIN_PASSWORD_HASH =
  "scrypt$16384$8$1$default-admin-v1$bb574d19fd70be487cdf6165e8d5303a3fab6250306148cded3ab0140c531c6e690fe48fa88897c324668656092a01d497de9ab23d83294e6d5ca6025bb45358";

type UserRow = RowDataPacket & {
  id: number;
  password_hash: string;
  username: string;
};

let setupPromise: Promise<void> | null = null;

export async function ensureUserTableAndSeed() {
  setupPromise ??= setupUsers().catch((error: unknown) => {
    setupPromise = null;
    throw error;
  });

  return setupPromise;
}

export async function authenticateUser(username: string, password: string) {
  await ensureUserTableAndSeed();

  const users = await query<UserRow[]>(
    "SELECT id, username, password_hash FROM `user` WHERE username = ? LIMIT 1",
    [username],
  );
  const user = users[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
  };
}

async function setupUsers() {
  await query(
    `CREATE TABLE IF NOT EXISTS \`user\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY user_username_unique (username)
    ) ENGINE=InnoDB`,
  );

  await query(
    `INSERT INTO \`user\` (username, password_hash)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE username = VALUES(username)`,
    ["admin", DEFAULT_ADMIN_PASSWORD_HASH],
  );
}

function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, cost, blockSize, parallelization, salt, hash] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !salt || !hash) {
    return false;
  }

  const expectedHash = Buffer.from(hash, "hex");
  const actualHash = scryptSync(password, salt, expectedHash.length, {
    N: Number(cost),
    p: Number(parallelization),
    r: Number(blockSize),
  });

  return (
    expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
  );
}
