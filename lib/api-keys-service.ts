import { apiKeyStore } from "./api-keys";
import { isMysqlConfigured } from "./mysql";
import type { ApiKey } from "./api-keys";
import * as repo from "./api-keys-repo";

export async function validateApiKey(key: string): Promise<ApiKey | null> {
  if (isMysqlConfigured()) {
    try {
      const r = await repo.validateKey(key);
      return r
        ? {
            id: r.id,
            key: r.key,
            collectionName: r.collectionName,
            systemPrompt: r.systemPrompt,
            createdAt: r.createdAt,
            lastUsed: r.lastUsed,
            requestCount: r.requestCount,
            active: r.active,
          }
        : null;
    } catch {
      return null;
    }
  }
  return apiKeyStore.validateKey(key);
}

export async function getKeyByCollection(collectionName: string): Promise<ApiKey | null> {
  if (isMysqlConfigured()) {
    try {
      const r = await repo.getKeyByCollection(collectionName);
      return r
        ? {
            id: r.id,
            key: r.key,
            collectionName: r.collectionName,
            systemPrompt: r.systemPrompt,
            createdAt: r.createdAt,
            lastUsed: r.lastUsed,
            requestCount: r.requestCount,
            active: r.active,
          }
        : null;
    } catch {
      return null;
    }
  }
  return apiKeyStore.getKeyByCollection(collectionName);
}

export async function ensureKeyForCollection(collectionName: string, systemPrompt = ""): Promise<void> {
  if (isMysqlConfigured()) {
    try {
      await repo.generateKeyForCollection(collectionName, systemPrompt);
      return;
    } catch {
      // fall back
    }
  }
  apiKeyStore.generateKeyForCollection(collectionName, systemPrompt);
}

export async function listAllKeys(): Promise<(Omit<ApiKey, "key"> & { maskedKey: string })[]> {
  if (isMysqlConfigured()) {
    try {
      return await repo.listAllKeys();
    } catch {
      return apiKeyStore.listAllKeys();
    }
  }
  return apiKeyStore.listAllKeys();
}

export async function regenerateKey(collectionName: string): Promise<ApiKey | null> {
  if (isMysqlConfigured()) {
    try {
      const r = await repo.regenerateKey(collectionName);
      return r
        ? {
            id: r.id,
            key: r.key,
            collectionName: r.collectionName,
            systemPrompt: r.systemPrompt,
            createdAt: r.createdAt,
            lastUsed: r.lastUsed,
            requestCount: r.requestCount,
            active: r.active,
          }
        : null;
    } catch {
      return null;
    }
  }
  return apiKeyStore.regenerateKey(collectionName);
}

export async function updateSystemPrompt(collectionName: string, systemPrompt: string): Promise<boolean> {
  if (isMysqlConfigured()) {
    try {
      return await repo.updateSystemPrompt(collectionName, systemPrompt);
    } catch {
      return false;
    }
  }
  return apiKeyStore.updateSystemPrompt(collectionName, systemPrompt);
}

export async function revokeKey(id: string): Promise<boolean> {
  if (isMysqlConfigured()) {
    try {
      return await repo.revokeKey(id);
    } catch {
      return false;
    }
  }
  return apiKeyStore.revokeKey(id);
}
