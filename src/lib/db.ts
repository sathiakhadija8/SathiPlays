import mysql, { type Pool } from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: Pool | undefined;
}

function createPool() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'sathia',
    password: process.env.MYSQL_PASSWORD ?? 'sathiapass',
    database: process.env.MYSQL_DATABASE ?? 'sathiplays',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

const pool = global.__mysqlPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  global.__mysqlPool = pool;
}

export default pool;
