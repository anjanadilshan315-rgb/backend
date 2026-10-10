import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from './env.js';

export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  // DATE columns stay as 'YYYY-MM-DD' strings so they never shift by time zone.
  dateStrings: ['DATE'],
  decimalNumbers: true,
  enableKeepAlive: true,
});

// Every session works in UTC so TIMESTAMP columns, UTC_TIMESTAMP() and the
// JS Dates written by the app all agree, whatever the server's time zone is.
pool.on('connection', (connection) => {
  connection.query(`SET time_zone = '+00:00'`);
});

/** A pool or a connection inside a transaction — repositories accept either. */
export type DbExecutor = Pool | PoolConnection;

export type SqlParams = unknown[];

export async function findMany<T>(
  sql: string,
  params: SqlParams = [],
  db: DbExecutor = pool,
): Promise<T[]> {
  const [rows] = await db.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function findOne<T>(
  sql: string,
  params: SqlParams = [],
  db: DbExecutor = pool,
): Promise<T | null> {
  const rows = await findMany<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: SqlParams = [],
  db: DbExecutor = pool,
): Promise<ResultSetHeader> {
  const [result] = await db.query<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function pingDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
