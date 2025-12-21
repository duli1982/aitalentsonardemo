// useUrlState - Sync React state with URL query parameters
// Enables deep linking and shareable URLs

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type ParamValue = string | number | boolean | null;

export function useUrlState<T extends Record<string, ParamValue>>(
    defaults: T
): [T, (updates: Partial<T>) => void] {
    const [searchParams, setSearchParams] = useSearchParams();

    // Parse current URL params into typed object
    const state = useMemo(() => {
        const result = { ...defaults };

        for (const key of Object.keys(defaults)) {
            const urlValue = searchParams.get(key);
            if (urlValue !== null) {
                const defaultValue = defaults[key];

                // Type-coerce based on default value type
                if (typeof defaultValue === 'number') {
                    (result as any)[key] = Number(urlValue) || defaultValue;
                } else if (typeof defaultValue === 'boolean') {
                    (result as any)[key] = urlValue === 'true';
                } else {
                    (result as any)[key] = urlValue;
                }
            }
        }

        return result;
    }, [searchParams, defaults]);

    // Update URL params
    const setState = useCallback((updates: Partial<T>) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);

            for (const [key, value] of Object.entries(updates)) {
                if (value === null || value === undefined || value === defaults[key]) {
                    newParams.delete(key); // Remove default values to keep URL clean
                } else {
                    newParams.set(key, String(value));
                }
            }

            return newParams;
        });
    }, [setSearchParams, defaults]);

    return [state, setState];
}

// Convenience hook for common patterns
export function useUrlParam(key: string, defaultValue: string = ''): [string, (v: string) => void] {
    const [state, setState] = useUrlState({ [key]: defaultValue });
    return [state[key] as string, (v: string) => setState({ [key]: v })];
}
