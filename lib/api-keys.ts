import { v4 as uuidv4 } from "uuid";

export interface ApiKey {
  id: string;
  key: string;
  collectionName: string;
  systemPrompt: string;
  createdAt: number;
  lastUsed: number | null;
  requestCount: number;
  active: boolean;
}

class ApiKeyStore {
  private keys: Map<string, ApiKey> = new Map();

  /** Auto-generate a key for a collection */
  generateKeyForCollection(collectionName: string, systemPrompt: string = ""): ApiKey {
    // Check if collection already has a key
    const existing = this.getKeyByCollection(collectionName);
    if (existing) {
      // Update system prompt if provided
      if (systemPrompt) existing.systemPrompt = systemPrompt;
      return existing;
    }

    const id = uuidv4();
    const key = `dp_${uuidv4().replace(/-/g, "")}`;
    const apiKey: ApiKey = {
      id,
      key,
      collectionName,
      systemPrompt,
      createdAt: Date.now(),
      lastUsed: null,
      requestCount: 0,
      active: true,
    };
    this.keys.set(id, apiKey);
    return apiKey;
  }

  /** Find key by API key string, increment usage */
  validateKey(key: string): ApiKey | null {
    for (const apiKey of this.keys.values()) {
      if (apiKey.key === key && apiKey.active) {
        apiKey.lastUsed = Date.now();
        apiKey.requestCount += 1;
        return apiKey;
      }
    }
    return null;
  }

  /** Update system prompt for a collection's key */
  updateSystemPrompt(collectionName: string, systemPrompt: string): boolean {
    const apiKey = this.getKeyByCollection(collectionName);
    if (!apiKey) return false;
    apiKey.systemPrompt = systemPrompt;
    return true;
  }

  /** Get key by collection name */
  getKeyByCollection(collectionName: string): ApiKey | null {
    for (const apiKey of this.keys.values()) {
      if (apiKey.collectionName === collectionName) {
        return apiKey;
      }
    }
    return null;
  }

  revokeKey(id: string): boolean {
    const apiKey = this.keys.get(id);
    if (!apiKey) return false;
    apiKey.active = false;
    return true;
  }

  /** Regenerate a key for a collection (revoke old, create new) */
  regenerateKey(collectionName: string): ApiKey | null {
    const old = this.getKeyByCollection(collectionName);
    if (!old) return null;
    old.active = false;
    const id = uuidv4();
    const key = `dp_${uuidv4().replace(/-/g, "")}`;
    const apiKey: ApiKey = {
      id,
      key,
      collectionName,
      systemPrompt: old.systemPrompt,
      createdAt: Date.now(),
      lastUsed: null,
      requestCount: 0,
      active: true,
    };
    this.keys.set(id, apiKey);
    return apiKey;
  }

  listKeys(): ApiKey[] {
    return Array.from(this.keys.values())
      .filter((k) => k.active)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  listAllKeys(): (Omit<ApiKey, "key"> & { maskedKey: string })[] {
    return Array.from(this.keys.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((k) => ({
        id: k.id,
        collectionName: k.collectionName,
        systemPrompt: k.systemPrompt,
        maskedKey: `${k.key.slice(0, 6)}...${k.key.slice(-4)}`,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
        requestCount: k.requestCount,
        active: k.active,
      }));
  }

  getFullKey(id: string): string | null {
    const apiKey = this.keys.get(id);
    return apiKey ? apiKey.key : null;
  }
}

export const apiKeyStore = new ApiKeyStore();
