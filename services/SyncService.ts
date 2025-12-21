// SyncService - Real-time multiplayer sync architecture
// Ready to plug into Liveblocks, Supabase Realtime, or WebSockets

import { eventBus, EVENTS } from '../utils/EventBus';

// Types for collaborative data
interface CursorPosition {
    x: number;
    y: number;
    userId: string;
    userName: string;
    color: string;
}

interface SyncedState<T> {
    data: T;
    version: number;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

interface SyncAdapter {
    connect(): Promise<void>;
    disconnect(): void;
    subscribe<T>(room: string, callback: (state: SyncedState<T>) => void): () => void;
    publish<T>(room: string, data: T): Promise<void>;
    updateCursor(room: string, position: CursorPosition): void;
    onCursors(room: string, callback: (cursors: CursorPosition[]) => void): () => void;
}

// Local adapter - simulates sync without backend
class LocalSyncAdapter implements SyncAdapter {
    private rooms: Map<string, any> = new Map();
    private cursors: Map<string, CursorPosition[]> = new Map();
    private subscribers: Map<string, Set<Function>> = new Map();
    private cursorSubscribers: Map<string, Set<Function>> = new Map();

    async connect(): Promise<void> {
        console.log('[SyncService] Connected (local mode)');
    }

    disconnect(): void {
        this.rooms.clear();
        this.subscribers.clear();
    }

    subscribe<T>(room: string, callback: (state: SyncedState<T>) => void): () => void {
        if (!this.subscribers.has(room)) {
            this.subscribers.set(room, new Set());
        }
        this.subscribers.get(room)!.add(callback);

        // Send current state if exists
        if (this.rooms.has(room)) {
            callback(this.rooms.get(room));
        }

        return () => {
            this.subscribers.get(room)?.delete(callback);
        };
    }

    async publish<T>(room: string, data: T): Promise<void> {
        const state: SyncedState<T> = {
            data,
            version: (this.rooms.get(room)?.version || 0) + 1,
            lastModifiedBy: 'local-user',
            lastModifiedAt: new Date().toISOString(),
        };

        this.rooms.set(room, state);

        // Notify subscribers
        this.subscribers.get(room)?.forEach(cb => cb(state));
    }

    updateCursor(room: string, position: CursorPosition): void {
        if (!this.cursors.has(room)) {
            this.cursors.set(room, []);
        }

        const cursors = this.cursors.get(room)!;
        const existingIndex = cursors.findIndex(c => c.userId === position.userId);

        if (existingIndex >= 0) {
            cursors[existingIndex] = position;
        } else {
            cursors.push(position);
        }

        // Notify cursor subscribers
        this.cursorSubscribers.get(room)?.forEach(cb => cb([...cursors]));
    }

    onCursors(room: string, callback: (cursors: CursorPosition[]) => void): () => void {
        if (!this.cursorSubscribers.has(room)) {
            this.cursorSubscribers.set(room, new Set());
        }
        this.cursorSubscribers.get(room)!.add(callback);

        // Send current cursors
        callback(this.cursors.get(room) || []);

        return () => {
            this.cursorSubscribers.get(room)?.delete(callback);
        };
    }
}

// Liveblocks adapter stub (for future implementation)
class LiveblocksAdapter implements SyncAdapter {
    private roomId: string = '';

    async connect(): Promise<void> {
        // Would initialize Liveblocks client here
        console.log('[SyncService] Liveblocks adapter not implemented. Using local mode.');
        throw new Error('Liveblocks not configured. Set VITE_LIVEBLOCKS_KEY');
    }

    disconnect(): void { }
    subscribe<T>(_room: string, _callback: (state: SyncedState<T>) => void): () => void { return () => { }; }
    async publish<T>(_room: string, _data: T): Promise<void> { }
    updateCursor(_room: string, _position: CursorPosition): void { }
    onCursors(_room: string, _callback: (cursors: CursorPosition[]) => void): () => void { return () => { }; }
}

// Main SyncService
class SyncService {
    private adapter: SyncAdapter;

    constructor() {
        // Try to use Liveblocks if configured, otherwise use local
        const liveblocksKey = import.meta.env.VITE_LIVEBLOCKS_KEY;

        if (liveblocksKey) {
            this.adapter = new LiveblocksAdapter();
        } else {
            this.adapter = new LocalSyncAdapter();
        }
    }

    async connect(): Promise<void> {
        try {
            await this.adapter.connect();
        } catch (error) {
            console.warn('[SyncService] Falling back to local adapter');
            this.adapter = new LocalSyncAdapter();
            await this.adapter.connect();
        }
    }

    disconnect(): void {
        this.adapter.disconnect();
    }

    // Subscribe to room state changes
    subscribe<T>(room: string, callback: (state: SyncedState<T>) => void): () => void {
        return this.adapter.subscribe(room, callback);
    }

    // Publish state update
    async publish<T>(room: string, data: T): Promise<void> {
        await this.adapter.publish(room, data);
        eventBus.emit(EVENTS.DATA_SYNCED, { room, data });
    }

    // Update cursor position
    updateCursor(room: string, position: Omit<CursorPosition, 'userId' | 'userName' | 'color'>): void {
        const fullPosition: CursorPosition = {
            ...position,
            userId: 'local-user',
            userName: 'You',
            color: '#3b82f6',
        };
        this.adapter.updateCursor(room, fullPosition);
    }

    // Subscribe to cursor updates
    onCursors(room: string, callback: (cursors: CursorPosition[]) => void): () => void {
        return this.adapter.onCursors(room, callback);
    }
}

export const syncService = new SyncService();
export type { CursorPosition, SyncedState };
