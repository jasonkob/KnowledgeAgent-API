import { v4 as uuidv4 } from "uuid";
import type { RowDataPacket } from "mysql2/promise";
import { getMysqlPool } from "./mysql";

export interface ApiKeyRecord {
  id: string;
  key: string;
  collectionName: string;
  systemPrompt: string;
  createdAt: number;
  lastUsed: number | null;
  requestCount: number;
  active: boolean;
}

const TABLE = "api_keys";

function mapRow(r: {
  id: string;
  api_key: string;
  collection_name: string;
  system_prompt: string;
  created_at_ms: number;
  last_used_ms: number | null;
  request_count: number;
  active: number;
}): ApiKeyRecord {
  return {
    id: r.id,
    key: r.api_key,
    collectionName: r.collection_name,
    systemPrompt: r.system_prompt || "",
    createdAt: Number(r.created_at_ms),
    lastUsed: r.last_used_ms === null ? null : Number(r.last_used_ms),
    requestCount: Number(r.request_count),
    active: Boolean(r.active),
  };
}

export async function listAllKeys(): Promise<(Omit<ApiKeyRecord, "key"> & { maskedKey: string })[]> {
  const pool = getMysqlPool();
  if (!pool) return [];

  const [rows] = await pool.query<
    (RowDataPacket & {
      id: string;
      api_key: string;
      collection_name: string;
      system_prompt: string;
      created_at_ms: number;
      last_used_ms: number | null;
      request_count: number;
      active: number;
    })[]
  >(`SELECT * FROM ${TABLE} ORDER BY created_at_ms DESC`);

  return rows.map((r) => {
    const rec = mapRow(r);
    return {
      id: rec.id,
      collectionName: rec.collectionName,
      systemPrompt: rec.systemPrompt,
      maskedKey: `${rec.key.slice(0, 6)}...${rec.key.slice(-4)}`,
      createdAt: rec.createdAt,
      lastUsed: rec.lastUsed,
      requestCount: rec.requestCount,
      active: rec.active,
    };
  });
}

export async function getKeyByCollection(collectionName: string): Promise<ApiKeyRecord | null> {
  const pool = getMysqlPool();
  if (!pool) return null;

  const [rows] = await pool.query<
    (RowDataPacket & {
      id: string;
      api_key: string;
      collection_name: string;
      system_prompt: string;
      created_at_ms: number;
      last_used_ms: number | null;
      request_count: number;
      active: number;
    })[]
  >(
    `SELECT * FROM ${TABLE} WHERE collection_name = ? ORDER BY created_at_ms DESC LIMIT 1`,
    [collectionName]
  );

  const r = rows[0];
  if (!r) return null;
  return mapRow(r);
}

export async function generateKeyForCollection(collectionName: string, systemPrompt = ""): Promise<ApiKeyRecord> {
  const pool = getMysqlPool();
  if (!pool) throw new Error("MySQL is not configured");

  const existing = await getKeyByCollection(collectionName);
  if (existing) {
    if (systemPrompt) {
      await updateSystemPrompt(collectionName, systemPrompt);
      return { ...existing, systemPrompt };
    }
    return existing;
  }

  const id = uuidv4();
  const key = `dp_${uuidv4().replace(/-/g, "")}`;
  const createdAt = Date.now();

  await pool.execute(
    `INSERT INTO ${TABLE} (id, api_key, collection_name, system_prompt, created_at_ms, last_used_ms, request_count, active)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 1)`,
    [id, key, collectionName, systemPrompt || "", createdAt]
  );

  return {
    id,
    key,
    collectionName,
    systemPrompt: systemPrompt || "",
    createdAt,
    lastUsed: null,
    requestCount: 0,
    active: true,
  };
}

export async function validateKey(key: string): Promise<ApiKeyRecord | null> {
  const pool = getMysqlPool();
  if (!pool) return null;

  const [rows] = await pool.query<
    (RowDataPacket & {
      id: string;
      api_key: string;
      collection_name: string;
      system_prompt: string;
      created_at_ms: number;
      last_used_ms: number | null;
      request_count: number;
      active: number;
    })[]
  >(
    `SELECT * FROM ${TABLE} WHERE api_key = ? AND active = 1 LIMIT 1`,
    [key]
  );

  const r = rows[0];
  if (!r) return null;

  await pool.execute(
    `UPDATE ${TABLE} SET last_used_ms = ?, request_count = request_count + 1 WHERE id = ?`,
    [Date.now(), r.id]
  );

  return mapRow({ ...r, last_used_ms: Date.now(), request_count: Number(r.request_count) + 1 });
}

export async function updateSystemPrompt(collectionName: string, systemPrompt: string): Promise<boolean> {
  const pool = getMysqlPool();
  if (!pool) return false;

  const [result] = await pool.execute(
    `UPDATE ${TABLE} SET system_prompt = ? WHERE collection_name = ? AND active = 1`,
    [systemPrompt || "", collectionName]
  );

  // mysql2 returns ResultSetHeader for execute
  const affectedRows = (result as any)?.affectedRows as number | undefined;
  return Boolean(affectedRows && affectedRows > 0);
}

export async function revokeKey(id: string): Promise<boolean> {
  const pool = getMysqlPool();
  if (!pool) return false;

  const [result] = await pool.execute(
    `UPDATE ${TABLE} SET active = 0 WHERE id = ?`,
    [id]
  );
  const affectedRows = (result as any)?.affectedRows as number | undefined;
  return Boolean(affectedRows && affectedRows > 0);
}

export async function regenerateKey(collectionName: string): Promise<ApiKeyRecord | null> {
  const pool = getMysqlPool();
  if (!pool) return null;

  const old = await getKeyByCollection(collectionName);
  if (!old) return null;

  await pool.execute(`UPDATE ${TABLE} SET active = 0 WHERE collection_name = ? AND active = 1`, [collectionName]);

  const id = uuidv4();
  const key = `dp_${uuidv4().replace(/-/g, "")}`;
  const createdAt = Date.now();

  await pool.execute(
    `INSERT INTO ${TABLE} (id, api_key, collection_name, system_prompt, created_at_ms, last_used_ms, request_count, active)
     VALUES (?, ?, ?, ?, ?, NULL, 0, 1)`,
    [id, key, collectionName, old.systemPrompt || "", createdAt]
  );

  return {
    id,
    key,
    collectionName,
    systemPrompt: old.systemPrompt || "",
    createdAt,
    lastUsed: null,
    requestCount: 0,
    active: true,
  };
}
