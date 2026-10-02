import mysql, { type ExecuteValues } from "mysql2/promise";

let pool: mysql.Pool | undefined;

export function getDbPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME || "email_sending_project",
      user: process.env.DB_USER || "email_app",
      password: process.env.DB_PASSWORD || "",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return pool;
}

export async function query<T extends mysql.QueryResult>(
  sql: string,
  values: ExecuteValues = [],
) {
  const [rows] = await getDbPool().execute<T>(sql, values);
  return rows;
}

export async function withTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>,
) {
  const connection = await getDbPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
