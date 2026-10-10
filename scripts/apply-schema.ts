/**
 * Applies database/schema.sql using the DB_* settings from .env.
 *   npm run db:schema
 * The schema is idempotent (CREATE ... IF NOT EXISTS / INSERT IGNORE), so it is
 * safe to run again; it never drops data.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const schemaPath = fileURLToPath(new URL('../database/schema.sql', import.meta.url));
const dbName = process.env.DB_NAME ?? 'railway';

if (!/^\w+$/.test(dbName)) {
  console.error(`DB_NAME "${dbName}" may only contain letters, numbers and underscores.`);
  process.exit(1);
}

let sql = await readFile(schemaPath, 'utf8');
// Use DB_NAME from .env instead of the database name written in the file.
const fileDbName = /CREATE DATABASE IF NOT EXISTS `(\w+)`/.exec(sql)?.[1];
if (fileDbName && fileDbName !== dbName) sql = sql.replaceAll(`\`${fileDbName}\``, `\`${dbName}\``);

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  multipleStatements: true,
});

try {
  await connection.query(sql);
  const [tables] = await connection.query(`SHOW TABLES FROM \`${dbName}\``);
  console.log(`Schema applied to "${dbName}" (${(tables as unknown[]).length} tables).`);
} catch (error) {
  console.error('Failed to apply the schema:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
