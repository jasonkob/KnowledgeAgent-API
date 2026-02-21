import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getEnv(name: string): string {
  return (process.env[name] || "").trim();
}

export function isMysqlConfigured(): boolean {
  return Boolean(getEnv("MYSQL_URL") || getEnv("MYSQL_HOST") || getEnv("MYSQL_DATABASE"));
}

export function getMysqlPool(): mysql.Pool | null {
  if (!isMysqlConfigured()) return null;
  if (pool) return pool;

  const url = getEnv("MYSQL_URL");
  if (url) {
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    return pool;
  }

  const host = getEnv("MYSQL_HOST") || "127.0.0.1";
  const port = Number(getEnv("MYSQL_PORT") || "3306");
  const user = getEnv("MYSQL_USER") || "root";
  const password = getEnv("MYSQL_PASSWORD");
  const database = getEnv("MYSQL_DATABASE") || "docspipeline";

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return pool;
}
