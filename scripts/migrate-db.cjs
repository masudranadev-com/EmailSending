const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");

const migrationsDirectory = path.join(__dirname, "..", "docker", "mysql", "migrations");
const ignoredDuplicateErrors = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_TABLE_EXISTS_ERROR",
]);

function migrationStatements(sql) {
  return sql
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_NAME || !DB_USER) {
    throw new Error("DB_HOST, DB_NAME, and DB_USER must be set before running migrations.");
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT || 3306),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD || "",
    charset: "utf8mb4",
  });

  try {
    const [lockRows] = await connection.query("SELECT GET_LOCK(?, 60) AS acquired", [
      `emailsendingproject:migrate:${DB_NAME}`,
    ]);
    if (lockRows[0]?.acquired !== 1) {
      throw new Error("Could not acquire the database migration lock within 60 seconds.");
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        migration_name VARCHAR(255) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (migration_name)
      ) ENGINE=InnoDB
    `);

    const migrationFiles = await fs.readdir(migrationsDirectory);
    const orderedFiles = migrationFiles.filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    const [appliedRows] = await connection.query(
      "SELECT migration_name FROM app_schema_migrations",
    );
    const applied = new Set(appliedRows.map((row) => row.migration_name));

    for (const filename of orderedFiles) {
      if (applied.has(filename)) continue;

      const sql = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");
      for (const statement of migrationStatements(sql)) {
        if (/^\s*(DROP\s+(DATABASE|SCHEMA|TABLE|VIEW)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i.test(statement)) {
          throw new Error(
            `Refusing destructive statement in ${filename}; production tables and rows must be preserved.`,
          );
        }

        try {
          await connection.query(statement);
        } catch (error) {
          if (!ignoredDuplicateErrors.has(error.code)) throw error;
          console.log(`Skipping already present schema item while applying ${filename}.`);
        }
      }

      await connection.execute(
        "INSERT INTO app_schema_migrations (migration_name) VALUES (?)",
        [filename],
      );
      console.log(`Applied database migration ${filename}.`);
    }

    console.log("Database migrations are up to date.");
  } finally {
    try {
      await connection.query("SELECT RELEASE_LOCK(?)", [`emailsendingproject:migrate:${DB_NAME}`]);
    } finally {
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
