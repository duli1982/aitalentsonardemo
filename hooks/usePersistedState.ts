// usePersistedState - React hook for localStorage-backed state
// State survives page refreshes and browser restarts

import { useState, useEffect, useCallback } from 'react';

const STATE_VERSION = 1; // Increment when schema changes

interface PersistedValue<T> {
    version: number;
    data: T;
    timestamp: number;
}

export function usePersistedState<T>(
    key: string,
    initialValue: T,
    options: {
        debounceMs?: number;
        migrate?: (oldData: any, oldVersion: number) => T;
    } = {}
): [T, React.Dispatch<React.SetStateAction<T>>, { clear: () => void; isLoaded: boolean }] {
    const { debounceMs = 500, migrate } = options;
    const [isLoaded, setIsLoaded] = useState(false);

    // Lazy initialization from localStorage
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;

        try {
            const stored = localStorage.getItem(`ts_${key}`);
            if (!stored) return initialValue;

            const parsed: PersistedValue<T> = JSON.parse(stored);

            // Version check and migration
            if (parsed.version !== STATE_VERSION) {
                if (migrate) {
                    return migrate(parsed.data, parsed.version);
                }
                // If no migration, reset to initial
                console.warn(`[Persistence] Schema mismatch for ${key}, resetting`);
                return initialValue;
            }

            return parsed.data;
        } catch (e) {
            console.error(`[Persistence] Failed to load ${key}:`, e);
            return initialValue;
        }
    });

    // Mark as loaded after first render
    useEffect(() => {
        setIsLoaded(true);
    }, []);

    // Debounced save to localStorage
    useEffect(() => {
        if (!isLoaded) return;

        const timeout = setTimeout(() => {
            try {
                const toStore: PersistedValue<T> = {
                    version: STATE_VERSION,
                    data: state,
                    timestamp: Date.now()
                };
                localStorage.setItem(`ts_${key}`, JSON.stringify(toStore));
            } catch (e) {
                console.error(`[Persistence] Failed to save ${key}:`, e);
            }
        }, debounceMs);

        return () => clearTimeout(timeout);
    }, [state, key, debounceMs, isLoaded]);

    // Clear function
    const clear = useCallback(() => {
        localStorage.removeItem(`ts_${key}`);
        setState(initialValue);
    }, [key, initialValue]);

    return [state, setState, { clear, isLoaded }];
}

// Convenience hook for simple values
export function usePersistedValue<T>(key: string, initial: T) {
    const [value, setValue] = usePersistedState(key, initial);
    return [value, setValue] as const;
}
