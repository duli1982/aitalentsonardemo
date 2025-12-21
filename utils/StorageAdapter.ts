// StorageAdapter - Abstraction over storage backends
// Allows swapping localStorage for IndexedDB, API, etc.

export interface StorageAdapter {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
}

// localStorage implementation
export class LocalStorageAdapter implements StorageAdapter {
    private prefix: string;

    constructor(prefix: string = 'ts_') {
        this.prefix = prefix;
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : null;
        } catch {
            return null;
        }
    }

    async set<T>(key: string, value: T): Promise<void> {
        localStorage.setItem(this.prefix + key, JSON.stringify(value));
    }

    async remove(key: string): Promise<void> {
        localStorage.removeItem(this.prefix + key);
    }

    async clear(): Promise<void> {
        const keys = await this.keys();
        keys.forEach(key => localStorage.removeItem(this.prefix + key));
    }

    async keys(): Promise<string[]> {
        const allKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.prefix)) {
                allKeys.push(key.replace(this.prefix, ''));
            }
        }
        return allKeys;
    }
}

// IndexedDB implementation (stub for future)
export class IndexedDBAdapter implements StorageAdapter {
    private dbName: string;
    private storeName: string = 'data';

    constructor(dbName: string = 'TalentSonarDB') {
        this.dbName = dbName;
    }

    private async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    async get<T>(key: string): Promise<T | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result ?? null);
        });
    }

    async set<T>(key: string, value: T): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(value, key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async remove(key: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async keys(): Promise<string[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAllKeys();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result as string[]);
        });
    }
}

// Factory function
export const createStorageAdapter = (type: 'localStorage' | 'indexedDB' = 'localStorage'): StorageAdapter => {
    return type === 'indexedDB' ? new IndexedDBAdapter() : new LocalStorageAdapter();
};

// Default singleton
export const storage = createStorageAdapter('localStorage');
